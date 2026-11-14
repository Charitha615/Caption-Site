<?php

namespace Tests\Feature;

use App\Jobs\ProcessUploadedVideoJob;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Bring-your-own Google AI key: save, verify, remove, and use it for captioning. */
class AiKeyTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'AIzaSyTEST_user_key_1234567890abcd';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'ai.provider' => 'gemini',
            'ai.allow_server_key' => false,
            'ai.gemini.base_url' => 'https://gemini.test/v1beta',
            'ai.gemini.model' => 'test-model',
        ]);
    }

    public function test_saving_a_valid_key_verifies_it_and_stores_it_encrypted(): void
    {
        Http::fake(['gemini.test/v1beta/models/test-model' => Http::response(['name' => 'models/test-model'])]);
        [$user, $headers] = $this->userWithToken();

        $response = $this->withHeaders($headers)->putJson('/api/me/ai-key', ['api_key' => self::KEY])
            ->assertOk()
            ->assertJsonPath('data.ai_key.configured', true)
            ->assertJsonPath('data.ai_key.status', 'valid')
            ->assertJsonPath('data.ai_key.hint', 'abcd')
            ->assertJsonPath('data.ai_key.can_caption', true)
            ->assertJsonPath('data.ai_key.help_url', 'https://aistudio.google.com/app/api-keys');

        $this->assertStringNotContainsString(self::KEY, $response->getContent());
        $raw = DB::table('users')->where('id', $user->id)->value('gemini_api_key');
        $this->assertNotSame(self::KEY, $raw, 'stored encrypted');
        $this->assertSame(self::KEY, $user->fresh()->gemini_api_key);
        Http::assertSent(fn (Request $r) => $r->hasHeader('x-goog-api-key', self::KEY) && ! str_contains($r->url(), self::KEY));

        $this->withHeaders($headers)->getJson('/api/me')
            ->assertJsonPath('data.user.ai_key.status', 'valid')
            ->assertJsonMissingPath('data.user.gemini_api_key');
    }

    public function test_a_key_google_rejects_is_not_saved(): void
    {
        Http::fake(['gemini.test/*' => Http::response(['error' => ['message' => 'API key not valid.', 'details' => [['reason' => 'API_KEY_INVALID']]]], 400)]);
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->putJson('/api/me/ai-key', ['api_key' => self::KEY])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['api_key']);

        $this->assertFalse($user->fresh()->hasAiKey());
    }

    public function test_malformed_keys_are_rejected_without_calling_google(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->putJson('/api/me/ai-key', ['api_key' => 'short'])->assertStatus(422);
        $this->withHeaders($headers)->putJson('/api/me/ai-key', ['api_key' => str_repeat('a', 30).'<script>'])->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_key_is_saved_unverified_when_google_is_unreachable_and_can_be_verified_later(): void
    {
        Http::fakeSequence('gemini.test/*')
            ->pushStatus(503)
            ->push(['name' => 'models/test-model']);
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->putJson('/api/me/ai-key', ['api_key' => self::KEY])
            ->assertOk()->assertJsonPath('data.ai_key.status', 'unverified');

        $this->withHeaders($headers)->postJson('/api/me/ai-key/verify')
            ->assertOk()->assertJsonPath('data.ai_key.status', 'valid')->assertJsonPath('data.verification.result', 'valid');
    }

    public function test_key_can_be_removed(): void
    {
        [$user, $headers] = $this->userWithToken();
        $user->forceFill(['gemini_api_key' => self::KEY, 'gemini_key_hint' => 'abcd', 'gemini_key_status' => 'valid'])->save();

        $this->withHeaders($headers)->deleteJson('/api/me/ai-key')->assertOk()->assertJsonPath('data.ai_key.configured', false);

        $this->assertNull($user->fresh()->gemini_api_key);
    }

    public function test_uploads_and_generation_require_a_key(): void
    {
        Queue::fake();
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id, 'status' => Project::STATUS_READY]);
        MediaFile::create(['project_id' => $project->id, 'file_path' => 'x.mp4', 'file_name' => 'x.mp4', 'original_name' => 'x.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 10, 'duration' => 5]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'a.mp4', 'file_size' => 100])
            ->assertStatus(422)->assertJsonPath('code', 'ai_key_required');
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/generate-captions")
            ->assertStatus(422)->assertJsonPath('code', 'ai_key_required');
        Queue::assertNothingPushed();
    }

    public function test_server_key_is_used_only_when_allowed(): void
    {
        config(['ai.allow_server_key' => true, 'ai.gemini.api_key' => 'AIzaSERVER_key_000000000000000']);
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->getJson('/api/me/ai-key')
            ->assertJsonPath('data.ai_key.required', false)
            ->assertJsonPath('data.ai_key.can_caption', true);
    }

    public function test_pipeline_transcribes_with_the_owners_key_and_flags_it_when_rejected(): void
    {
        Storage::fake('local');
        $this->app->instance(VideoServiceInterface::class, new class implements VideoServiceInterface
        {
            public function getMetadata(string $filePath): array
            {
                return ['duration' => 5.0, 'width' => 1280, 'height' => 720, 'fps' => 30.0, 'codec' => 'h264', 'audio_codec' => 'aac', 'sample_rate' => 48000, 'channels' => 2, 'has_audio' => true];
            }

            public function extractAudio(string $videoPath, string $outputPath): string
            {
                file_put_contents($outputPath, 'audio');

                return $outputPath;
            }

            public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
            {
                return false;
            }
        });

        $owner = User::factory()->create();
        $owner->forceFill(['gemini_api_key' => self::KEY, 'gemini_key_hint' => 'abcd', 'gemini_key_status' => 'valid'])->save();
        $project = Project::factory()->create(['user_id' => $owner->id, 'status' => Project::STATUS_UPLOADED]);
        Storage::disk('local')->put('media/v.mp4', 'v');
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 1]);

        Http::fake(['gemini.test/*' => Http::response(['error' => ['message' => 'API key not valid.', 'details' => [['reason' => 'API_KEY_INVALID']]]], 400)]);

        ProcessUploadedVideoJob::dispatchSync($project, $media, 'si');

        Http::assertSent(fn (Request $r) => $r->hasHeader('x-goog-api-key', self::KEY));
        $this->assertSame(Project::STATUS_FAILED, $project->fresh()->status);
        $this->assertStringContainsString('Account & usage', $project->fresh()->processing_error);
        $this->assertSame(User::AI_KEY_INVALID, $owner->fresh()->gemini_key_status);
    }
}
