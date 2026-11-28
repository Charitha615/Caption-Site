<?php

namespace Tests\Feature;

use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use App\Services\Caption\CaptionStyleNormalizer;
use App\Services\Rendering\ProcessRunner;
use App\Services\Rendering\RenderOptions;
use App\Services\Rendering\SubjectMaskStore;
use App\Services\Rendering\VideoRendererService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Captions behind the person (Pro): the uploaded person outline, the export guard and the FFmpeg graph. */
class BehindSubjectTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A packed outline: every frame is `$w`×`$h`, background except a person block in the middle.
     */
    private function ssm(int $w = 8, int $h = 8, int $frames = 3, int $fps100 = 1000): string
    {
        $bytes = 'SSM1'.pack('vvVV', $w, $h, $fps100, $frames);
        // Rows: 3 background rows, then 2 rows with 4 person pixels in the middle, then the rest.
        $runs = [3 * $w + 2, 4, 4, 4, 2 + 3 * $w];
        $this->assertSame($w * $h, array_sum($runs));
        for ($i = 0; $i < $frames; $i++) {
            $body = pack('v*', ...$runs);
            $bytes .= pack('V', strlen($body)).$body;
        }

        return $bytes;
    }

    private function projectWithVideo(User $user, bool $behind = true): Project
    {
        Storage::fake('public');
        Storage::fake('local');
        Storage::disk('public')->put('media/v.mp4', 'video');
        $project = Project::factory()->create(['user_id' => $user->id, 'settings' => ['editor' => ['version' => 2, 'style' => ['preset' => 'bold', 'animation' => 'pop', 'behindSubject' => $behind]]]]);
        $project->captions()->create(['sequence' => 1, 'start_time' => 0, 'end_time' => 2, 'text' => 'ආයුබෝවන්', 'language' => 'si']);
        MediaFile::create([
            'project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4',
            'disk' => 'public', 'mime_type' => 'video/mp4', 'file_size' => 5, 'duration' => 4.0, 'width' => 1080, 'height' => 1920,
        ]);

        return $project;
    }

    private function putMask(Project $project, array $headers, string $bytes)
    {
        return $this->call('PUT', "/api/projects/{$project->uuid}/subject-mask", [], [], [], $this->transformHeadersToServerVars($headers + ['Content-Type' => 'application/octet-stream', 'Accept' => 'application/json']), $bytes);
    }

    public function test_the_style_flag_survives_normalising(): void
    {
        $normalizer = app(CaptionStyleNormalizer::class);

        $this->assertTrue($normalizer->normalize(['behindSubject' => true])['behindSubject']);
        $this->assertFalse($normalizer->normalize([])['behindSubject']);
        $this->assertArrayNotHasKey('behindSubject', $normalizer->normalizePartial(['behindSubject' => 'yes']));
    }

    public function test_pro_uploads_the_outline_and_exports_with_the_person_in_front(): void
    {
        Queue::fake();
        $user = User::factory()->pro()->create();
        $headers = ['Authorization' => 'Bearer '.$user->createToken('t')->plainTextToken];
        $project = $this->projectWithVideo($user);

        $this->withHeaders($headers)->getJson("/api/projects/{$project->uuid}/subject-mask")->assertOk()->assertJsonPath('data.ready', false);
        // Not found yet: the export asks the editor to find the person first.
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/exports", ['type' => 'mp4'])->assertUnprocessable();

        $this->putMask($project, $headers, 'nonsense')->assertUnprocessable();
        $this->putMask($project, $headers, substr($this->ssm(), 0, -2))->assertUnprocessable();
        $this->putMask($project, $headers, $this->ssm())->assertOk()->assertJsonPath('data.frames', 3);
        $this->withHeaders($headers)->getJson("/api/projects/{$project->uuid}/subject-mask")->assertJsonPath('data.ready', true);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/exports", ['type' => 'mp4'])->assertCreated();
        $this->assertTrue(Export::first()->metadata['behind_subject']);

        // A new video needs a new outline.
        MediaFile::create([
            'project_id' => $project->id, 'file_path' => 'media/v2.mp4', 'file_name' => 'v2.mp4', 'original_name' => 'v2.mp4',
            'disk' => 'public', 'mime_type' => 'video/mp4', 'file_size' => 5, 'duration' => 4.0, 'width' => 1080, 'height' => 1920,
        ]);
        $this->assertFalse(app(SubjectMaskStore::class)->isReady($project->fresh()));
    }

    public function test_free_cannot_use_it(): void
    {
        Queue::fake();
        [$user, $headers] = $this->userWithToken();
        $project = $this->projectWithVideo($user);

        $this->putMask($project, $headers, $this->ssm())->assertStatus(402)->assertJsonPath('code', 'usage_limit_exceeded');
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/exports", ['type' => 'mp4'])->assertStatus(402);
    }

    public function test_frames_are_written_as_greyscale_masks(): void
    {
        $dir = sys_get_temp_dir().'/ssm-'.uniqid();
        File::ensureDirectoryExists($dir);
        file_put_contents("{$dir}/m.ssm", $this->ssm(8, 8, 2));

        $out = SubjectMaskStore::writeFrames("{$dir}/m.ssm", "{$dir}/frames");

        $this->assertSame(2, $out['frames']);
        $this->assertSame(10.0, $out['fps']);
        $pgm = (string) file_get_contents("{$dir}/frames/mask_00001.pgm");
        $this->assertStringStartsWith("P5\n8 8\n255\n", $pgm);
        $pixels = substr($pgm, strlen("P5\n8 8\n255\n"));
        $this->assertSame(64, strlen($pixels));
        $this->assertSame(8, substr_count($pixels, "\xFF"));
        $this->assertSame("\x00\x00\xFF\xFF\xFF\xFF\x00\x00", substr($pixels, 24, 8));
        File::deleteDirectory($dir);
    }

    public function test_ffmpeg_draws_captions_then_the_person_then_the_watermark(): void
    {
        $svc = new VideoRendererService(new ProcessRunner, '/usr/bin/ffmpeg');
        $cmd = $svc->buildCommand(new RenderOptions(
            '/in.mp4', '/caps.ass', '/out.mp4', '/fonts', 720, 1280,
            maskPattern: '/work/mask/mask_%05d.pgm', maskFps: 7.5, sourceWidth: 1080, sourceHeight: 1920, frontSubtitlePath: '/front.ass',
        ));

        $this->assertSame('7.5', $cmd[array_search('-framerate', $cmd, true) + 1]);
        $this->assertContains('/work/mask/mask_%05d.pgm', $cmd);
        $graph = $cmd[array_search('-filter_complex', $cmd, true) + 1];
        $this->assertStringContainsString('[1:v]format=gray,scale=1080:1920', $graph);
        $this->assertStringContainsString('[cut][mask]alphamerge[person]', $graph);
        $this->assertMatchesRegularExpression('/\[base\]ass=filename=\/caps\.ass.*\[captioned\][\s\S]*\[captioned\]\[person\]overlay.*\[layered\];\[layered\]ass=filename=\/front\.ass.*\[out\]$/', $graph);
        $this->assertSame('[out]', $cmd[array_search('-map', $cmd, true) + 1]);
    }
}
