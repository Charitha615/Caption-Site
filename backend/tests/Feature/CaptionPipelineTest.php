<?php

namespace Tests\Feature;

use App\Exceptions\AIProviderException;
use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Caption;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\AI\AIProviderFactory;
use App\Services\AI\AIProviderInterface;
use App\Services\AI\FakeAIProvider;
use App\Services\Media\MediaStorage;
use App\Services\Usage\UsageService;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Jobs\FakeJob;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CaptionPipelineTest extends TestCase
{
    use RefreshDatabase;

    private int $aiCalls = 0;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->fakeVideo();
    }

    private function fakeVideo(bool $hasAudio = true, float $duration = 12.0): void
    {
        $this->app->instance(VideoServiceInterface::class, new class($hasAudio, $duration) implements VideoServiceInterface
        {
            public function __construct(private bool $hasAudio, private float $duration) {}

            public function getMetadata(string $filePath): array
            {
                return ['duration' => $this->duration, 'width' => 1080, 'height' => 1920, 'fps' => 30.0, 'codec' => 'h264', 'audio_codec' => 'aac', 'sample_rate' => 48000, 'channels' => 2, 'has_audio' => $this->hasAudio];
            }

            public function extractAudio(string $videoPath, string $outputPath): string
            {
                file_put_contents($outputPath, 'ID3-audio');

                return $outputPath;
            }

            public function splitAudio(string $audioPath, float $totalSeconds, int $seconds, string $outputDir): array
            {
                @mkdir($outputDir, 0700, true);
                $chunks = [];
                for ($i = 0, $o = 0.0; $o < $totalSeconds; $i++, $o += $seconds) {
                    file_put_contents($p = "{$outputDir}/c{$i}.mp3", 'audio');
                    $chunks[] = ['path' => $p, 'offset' => $o, 'duration' => min($seconds, $totalSeconds - $o)];
                }

                return $chunks;
            }

            public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
            {
                file_put_contents($outputPath, 'jpeg');

                return true;
            }
        });
    }

    private function countingProvider(): void
    {
        $test = $this;
        $this->app->instance(AIProviderInterface::class, new class($test) extends FakeAIProvider
        {
            public function __construct(private $test) {}

            public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
            {
                $this->test->recordAiCall();

                return parent::transcribe($audioFilePath, $language, $options);
            }
        });
    }

    public function recordAiCall(): void
    {
        $this->aiCalls++;
    }

    private function projectWithVideo(?User $user = null): Project
    {
        $project = Project::factory()->create(['user_id' => ($user ?? User::factory()->create())->id, 'status' => Project::STATUS_UPLOADED]);
        Storage::disk('local')->put("media/{$project->uuid}/v.mp4", $this->mp4Bytes());
        MediaFile::create(['project_id' => $project->id, 'file_path' => "media/{$project->uuid}/v.mp4", 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 4096]);

        return $project;
    }

    public function test_pipeline_produces_captions_with_exactly_one_ai_request(): void
    {
        $this->countingProvider();
        $project = $this->projectWithVideo();

        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');

        $project->refresh();
        $this->assertSame(Project::STATUS_READY, $project->status);
        $this->assertSame(1, $this->aiCalls, 'transcription must not be requested twice');
        $this->assertSame(12.0, (float) $project->duration);
        $this->assertSame(1080, $project->width);
        $this->assertSame("thumbnails/{$project->uuid}.jpg", $project->thumbnail);
        Storage::disk('local')->assertExists("thumbnails/{$project->uuid}.jpg");
        Storage::disk('local')->assertExists("audio/{$project->uuid}.mp3");

        $captions = Caption::where('project_id', $project->id)->orderBy('sequence')->get();
        $this->assertCount(3, $captions);
        $this->assertSame('si', $captions[0]->language);
        $this->assertNotEmpty($captions[0]->metadata['words']);

        $this->assertSame(1, UsageRecord::where('action', UsageRecord::ACTION_AI_REQUEST)->count());
        $this->assertSame(12.0, (float) UsageRecord::where('action', UsageRecord::ACTION_CAPTION_GENERATION)->value('quantity'));
    }

    public function test_regenerating_replaces_existing_captions(): void
    {
        $project = $this->projectWithVideo();
        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');
        ProcessUploadedVideoJob::dispatchSync($project->fresh(), $project->primaryMediaFile, 'en');

        $this->assertSame(Project::STATUS_READY, $project->fresh()->status, (string) $project->fresh()->processing_error);
        $this->assertSame(3, Caption::withTrashed()->where('project_id', $project->id)->count());
        $this->assertSame('en', Caption::where('project_id', $project->id)->value('language'));
    }

    public function test_ai_failure_marks_project_failed_with_a_safe_message(): void
    {
        $this->app->instance(AIProviderInterface::class, new class extends FakeAIProvider
        {
            public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
            {
                throw new AIProviderException('The AI service is busy right now. Please try again in a few minutes.', ['status' => 429]);
            }
        });
        $project = $this->projectWithVideo();

        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');

        $project->refresh();
        $this->assertSame(Project::STATUS_FAILED, $project->status);
        $this->assertSame('The AI service is busy right now. Please try again in a few minutes.', $project->processing_error);
        $this->assertSame(0, Caption::where('project_id', $project->id)->count(), 'never invents captions');
    }

    public function test_unexpected_errors_never_leak_internals_to_the_user(): void
    {
        $this->app->instance(AIProviderInterface::class, new class extends FakeAIProvider
        {
            public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
            {
                throw new \RuntimeException('SQLSTATE secret /var/www/storage/app/private');
            }
        });
        $project = $this->projectWithVideo();

        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');

        $this->assertStringNotContainsString('/var/www', (string) $project->fresh()->processing_error);
    }

    public function test_video_without_audio_fails_clearly(): void
    {
        $this->fakeVideo(hasAudio: false);
        $project = $this->projectWithVideo();

        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');

        $this->assertStringContainsString('no audio', $project->fresh()->processing_error);
    }

    public function test_status_endpoint_reports_failure_reason(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id, 'status' => Project::STATUS_FAILED, 'processing_error' => 'We could not extract the audio from this video.']);

        $this->withHeaders($headers)->getJson("/api/projects/{$project->uuid}/status")
            ->assertOk()
            ->assertJsonPath('data.is_failed', true)
            ->assertJsonPath('data.error', 'We could not extract the audio from this video.');
    }

    public function test_regenerate_is_rejected_while_already_processing(): void
    {
        Queue::fake();
        [$user, $headers] = $this->userWithToken();
        $project = $this->projectWithVideo($user);
        $project->update(['status' => Project::STATUS_TRANSCRIBING]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/generate-captions", ['language' => 'si'])->assertStatus(409);
        Queue::assertNothingPushed();

        $project->update(['status' => Project::STATUS_READY]);
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/generate-captions", ['language' => 'xx'])->assertStatus(422);
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/generate-captions", ['language' => 'en'])->assertStatus(202);
        Queue::assertPushed(ProcessUploadedVideoJob::class);
    }

    public function test_thumbnail_is_served_only_through_a_signed_url(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = $this->projectWithVideo($user);
        ProcessUploadedVideoJob::dispatchSync($project, $project->primaryMediaFile, 'si');

        $url = $this->withHeaders($headers)->getJson("/api/projects/{$project->uuid}")->json('data.project.thumbnail');
        $this->assertStringContainsString('signature=', $url);
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get(explode('?', $url)[0])->assertForbidden();
    }

    public function test_interrupted_projects_are_reset_so_users_can_retry(): void
    {
        $stuck = Project::factory()->create(['status' => Project::STATUS_TRANSCRIBING]);
        $stuck->forceFill(['updated_at' => now()->subHour()])->saveQuietly();
        $running = Project::factory()->create(['status' => Project::STATUS_TRANSCRIBING]);
        $waiting = Project::factory()->create(['status' => Project::STATUS_UPLOADED]);
        $waiting->forceFill(['updated_at' => now()->subHour()])->saveQuietly();

        $this->artisan('projects:reset-stuck')->assertSuccessful();

        $this->assertSame(Project::STATUS_FAILED, $stuck->fresh()->status);
        $this->assertSame('Processing was interrupted. Please retry.', $stuck->fresh()->processing_error);
        $this->assertSame(Project::STATUS_TRANSCRIBING, $running->fresh()->status);
        $this->assertSame(Project::STATUS_UPLOADED, $waiting->fresh()->status, 'queued jobs are not touched');
    }

    public function test_google_overload_requeues_the_job_instead_of_failing(): void
    {
        $this->app->instance(AIProviderInterface::class, new class extends FakeAIProvider
        {
            public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
            {
                throw new AIProviderException('Google’s AI is overloaded right now (high demand). Please retry in a few minutes.', ['reason' => 'overloaded']);
            }
        });
        $project = $this->projectWithVideo();
        $job = new ProcessUploadedVideoJob($project, $project->primaryMediaFile, 'si');
        $queued = new FakeJob;
        $job->setJob($queued);

        $job->handle(app(VideoServiceInterface::class), app(AIProviderFactory::class), app(MediaStorage::class), app(UsageService::class));

        $this->assertTrue($queued->isReleased());
        $this->assertSame(60, $queued->releaseDelay);
        $project->refresh();
        $this->assertSame(Project::STATUS_UPLOADED, $project->status);
        $this->assertStringContainsString('retrying automatically', $project->processing_error);

        [$user, $headers] = $this->userWithToken();
        $project->forceFill(['user_id' => $user->id])->save();
        $this->withHeaders($headers)->getJson("/api/projects/{$project->uuid}/status")->assertJsonPath('data.notice', $project->processing_error);
    }
}
