<?php

namespace Tests\Feature;

use App\Jobs\RenderVideoJob;
use App\Models\CaptionTemplate;
use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use App\Services\Rendering\ProcessRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExportApiTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');

        $this->owner = User::factory()->create();
        $this->project = Project::factory()->create([
            'user_id' => $this->owner->id,
            'name' => 'සිංහල ව්‍යාපෘතිය',
            'settings' => ['foo' => 'bar', 'editor' => ['version' => 2, 'style' => ['fontSize' => 64], 'canvas' => ['aspect' => '9:16']]],
        ]);
        $this->project->captions()->create(['sequence' => 1, 'start_time' => 0.5, 'end_time' => 2.0, 'text' => 'ශ්‍රී ලංකාව', 'language' => 'si']);
        $this->project->captions()->create(['sequence' => 2, 'start_time' => 2.5, 'end_time' => 4.0, 'text' => 'Hello <world>', 'language' => 'en']);
    }

    private function as(User $user)
    {
        // Sanctum caches the resolved user per test; reset it so each call really is that user.
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('t')->plainTextToken);
    }

    private function addVideo(int $width = 1920, int $height = 1080): MediaFile
    {
        Storage::disk('public')->put('media/v.mp4', 'video');

        return MediaFile::create([
            'project_id' => $this->project->id,
            'file_path' => 'media/v.mp4',
            'file_name' => 'v.mp4',
            'original_name' => 'v.mp4',
            'disk' => 'public',
            'mime_type' => 'video/mp4',
            'file_size' => 5,
            'duration' => 4.0,
            'width' => $width,
            'height' => $height,
        ]);
    }

    public function test_srt_export_is_created_and_downloadable_via_signed_url(): void
    {
        $res = $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'srt']);

        $res->assertStatus(201)
            ->assertJsonPath('data.export.type', 'srt')
            ->assertJsonPath('data.export.status', 'completed')
            ->assertJsonPath('data.export.progress', 100)
            ->assertJsonMissingPath('data.export.file_path')
            ->assertJsonPath('data.export.download_name', 'සිංහල-ව්‍යාපෘතිය.srt');

        $export = Export::firstOrFail();
        Storage::disk('local')->assertExists($export->file_path);
        $this->assertStringNotContainsString($export->file_path, $res->getContent(), 'storage path never leaks');

        $download = $this->get($res->json('data.export.download_url'));
        $download->assertOk();
        $this->assertStringContainsString("1\n00:00:00,500 --> 00:00:02,000\nශ්‍රී ලංකාව", $download->streamedContent());
        $this->assertStringContainsString('application/x-subrip', $download->headers->get('Content-Type'));
        // RFC 6266: browsers save the Sinhala name; the ASCII fallback is still a valid filename.
        $this->assertStringContainsString("filename*=utf-8''".rawurlencode('සිංහල-ව්‍යාපෘතිය.srt'), $download->headers->get('Content-Disposition'));
    }

    public function test_all_text_formats_export(): void
    {
        foreach (['vtt' => 'WEBVTT', 'txt' => 'Hello <world>', 'json' => '"version": 1'] as $type => $needle) {
            $url = $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => $type])
                ->assertStatus(201)->json('data.export.download_url');
            $this->assertStringContainsString($needle, $this->get($url)->streamedContent(), $type);
        }
    }

    public function test_download_requires_a_valid_unexpired_signature(): void
    {
        $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'txt'])->assertStatus(201);
        $export = Export::firstOrFail();

        $this->getJson("/api/exports/{$export->uuid}/download")->assertStatus(403);
        $this->getJson("/api/exports/{$export->uuid}/download?expires=9999999999&signature=forged")->assertStatus(403);

        $expired = URL::temporarySignedRoute('exports.download', now()->subMinute(), ['export' => $export->uuid]);
        $this->getJson($expired)->assertStatus(403);

        // A signature for one export can't be reused for another.
        $other = Export::create(['project_id' => $this->project->id, 'user_id' => $this->owner->id, 'type' => 'txt', 'status' => 'completed', 'file_path' => 'exports/x.txt']);
        $tampered = str_replace($export->uuid, $other->uuid, $export->temporaryDownloadUrl());
        $this->getJson($tampered)->assertStatus(403);
    }

    public function test_other_users_cannot_create_view_list_delete_or_get_download_links(): void
    {
        $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'srt'])->assertStatus(201);
        $export = Export::firstOrFail();
        $intruder = User::factory()->create();

        $this->as($intruder)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'srt'])->assertStatus(403);
        $this->as($intruder)->getJson("/api/projects/{$this->project->uuid}/exports")->assertStatus(403);
        $this->as($intruder)->getJson("/api/exports/{$export->uuid}")->assertStatus(403)->assertJsonMissingPath('data.export');
        $this->as($intruder)->deleteJson("/api/exports/{$export->uuid}")->assertStatus(403);
        $this->assertNotSoftDeleted($export);

        $this->app['auth']->forgetGuards();
        $this->withoutHeader('Authorization')->getJson("/api/projects/{$this->project->uuid}/exports")->assertStatus(401);
    }

    public function test_mp4_export_is_queued_not_rendered_in_the_request(): void
    {
        Queue::fake();
        $this->addVideo();
        $template = CaptionTemplate::create(['user_id' => $this->owner->id, 'name' => 'Mine', 'style' => ['textColor' => '#00FF00', 'positionY' => 10]]);

        $res = $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", [
            'type' => 'mp4', 'resolution' => '720', 'quality' => 'high', 'template' => $template->uuid,
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.export.status', 'queued')
            ->assertJsonPath('data.export.progress', 0)
            ->assertJsonPath('data.export.download_url', null)
            ->assertJsonPath('data.export.options.width', 720)
            ->assertJsonPath('data.export.options.height', 1280) // project canvas is 9:16
            ->assertJsonPath('data.export.options.template', 'Mine');

        Queue::assertPushed(RenderVideoJob::class, fn ($job) => $job->export->uuid === $res->json('data.export.uuid'));
        $meta = Export::firstOrFail()->metadata;
        $this->assertSame('#00FF00', $meta['style']['textColor']);
        $this->assertSame(64, $meta['style']['fontSize'], 'project style kept where template is silent');
    }

    public function test_mp4_validation(): void
    {
        Queue::fake();
        $url = "/api/projects/{$this->project->uuid}/exports";

        $this->as($this->owner)->postJson($url, ['type' => 'mp4'])->assertStatus(422)->assertJsonPath('errors.type.0', 'Upload a video to this project before exporting an MP4.');

        $this->addVideo(1920, 1080);
        $this->as($this->owner)->postJson($url, ['type' => 'mp4', 'resolution' => '2160'])->assertStatus(422)->assertJsonValidationErrors('resolution');
        $this->as($this->owner)->postJson($url, ['type' => 'exe'])->assertStatus(422)->assertJsonValidationErrors('type');
        $this->as($this->owner)->postJson($url, ['type' => 'mp4', 'quality' => 'ultra'])->assertStatus(422);
        $this->as($this->owner)->postJson($url, ['type' => 'mp4', 'template' => (string) Str::uuid()])->assertStatus(422)->assertJsonValidationErrors('template');

        $foreign = CaptionTemplate::create(['user_id' => User::factory()->create()->id, 'name' => 'Theirs', 'style' => []]);
        $this->as($this->owner)->postJson($url, ['type' => 'mp4', 'template' => $foreign->uuid])->assertStatus(422);

        $this->as($this->owner)->postJson($url, ['type' => 'mp4'])->assertStatus(201);
        $this->as($this->owner)->postJson($url, ['type' => 'mp4'])->assertStatus(201);
        $this->as($this->owner)->postJson($url, ['type' => 'mp4'])->assertStatus(422); // max 2 active renders
        Queue::assertPushed(RenderVideoJob::class, 2);
    }

    public function test_4k_allowed_when_source_is_4k(): void
    {
        Queue::fake();
        $this->addVideo(3840, 2160);
        $this->project->update(['settings' => ['editor' => ['canvas' => ['aspect' => 'source']]]]);

        $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'mp4', 'resolution' => '2160'])
            ->assertStatus(201)
            ->assertJsonPath('data.export.options.width', 3840)
            ->assertJsonPath('data.export.options.height', 2160);
    }

    public function test_status_list_and_delete(): void
    {
        $uuid = $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'vtt'])->json('data.export.uuid');
        $export = Export::where('uuid', $uuid)->firstOrFail();

        $this->as($this->owner)->getJson("/api/exports/{$uuid}")->assertOk()->assertJsonPath('data.export.status', 'completed');
        $this->as($this->owner)->getJson("/api/projects/{$this->project->uuid}/exports")->assertOk()->assertJsonCount(1, 'data.exports');

        $link = $export->temporaryDownloadUrl();
        $this->as($this->owner)->deleteJson("/api/exports/{$uuid}")->assertOk();
        Storage::disk('local')->assertMissing($export->file_path);
        $this->assertSoftDeleted($export);
        $this->getJson($link)->assertStatus(404); // old links stop working
        $this->as($this->owner)->getJson("/api/exports/{$uuid}")->assertStatus(404);
    }

    public function test_render_job_completes_export_with_fake_ffmpeg(): void
    {
        $this->addVideo(1280, 720);
        $this->app->instance(ProcessRunner::class, new class extends ProcessRunner
        {
            public array $ass = [];

            public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
            {
                if (in_array('-filters', $command, true)) {
                    return ['exitCode' => 0, 'stdout' => " .. ass  V->V  libass\n", 'stderr' => '', 'stopped' => false];
                }
                $vf = $command[array_search('-vf', $command, true) + 1];
                $out = substr(end($command), 5);
                file_put_contents($out, 'FAKE-MP4');
                $onStdout && $onStdout("out_time_us=2000000\nprogress=end\n");

                return ['exitCode' => 0, 'stdout' => '', 'stderr' => '', 'stopped' => false];
            }
        });

        $res = $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'mp4', 'resolution' => '720']);
        $res->assertStatus(201); // queue is sync in tests → job already ran

        $export = Export::firstOrFail();
        $this->assertSame('completed', $export->status);
        $this->assertSame(100, $export->progress);
        $this->assertNotNull($export->started_at);
        $this->assertNotNull($export->completed_at);
        Storage::disk('local')->assertExists($export->file_path);
        $this->assertSame('FAKE-MP4', $this->get($export->temporaryDownloadUrl())->streamedContent());
        $this->assertDatabaseHas('usage_records', ['project_id' => $this->project->id, 'action' => 'video_render']);
    }

    public function test_render_job_failure_is_recorded_with_a_safe_message(): void
    {
        $this->addVideo(1280, 720);
        $this->app->instance(ProcessRunner::class, new class extends ProcessRunner
        {
            public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
            {
                return ['exitCode' => 0, 'stdout' => " .. overlay VV->V\n", 'stderr' => '', 'stopped' => false];
            }
        });

        $this->as($this->owner)->postJson("/api/projects/{$this->project->uuid}/exports", ['type' => 'mp4'])->assertStatus(201);

        $export = Export::firstOrFail();
        $this->assertSame('failed', $export->status);
        $this->assertStringContainsString('no libass', $export->error_message);
        $this->as($this->owner)->getJson("/api/exports/{$export->uuid}")
            ->assertJsonPath('data.export.status', 'failed')
            ->assertJsonPath('data.export.download_url', null);
    }
}
