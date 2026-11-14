<?php

namespace Tests\Feature;

use App\Jobs\ProcessUploadedVideoJob;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UploadSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ChunkedUploadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Queue::fake();
        config(['captions.uploads.chunk_size' => 1024]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/chunks'));
        parent::tearDown();
    }

    private function putChunk(array $headers, string $uuid, int $index, string $bytes)
    {
        return $this->call('PUT', "/api/uploads/{$uuid}/chunks/{$index}", [], [], [], $this->transformHeadersToServerVars($headers + [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Accept' => 'application/json',
        ]), $bytes);
    }

    public function test_file_is_uploaded_in_chunks_resumed_and_assembled_privately(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $bytes = $this->mp4Bytes(2500); // 3 chunks: 1024 + 1024 + 452
        $chunks = str_split($bytes, 1024);

        $start = $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", [
            'file_name' => 'සිංහල vlog.mp4', 'file_size' => strlen($bytes), 'language' => 'si',
        ])->assertStatus(201)->assertJsonPath('data.upload.total_chunks', 3);
        $uuid = $start->json('data.upload.uuid');

        $this->putChunk($headers, $uuid, 0, $chunks[0])->assertOk();
        $this->putChunk($headers, $uuid, 2, $chunks[2])->assertOk();

        // Connection drops; the client asks again and learns what is missing.
        $resume = $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", [
            'file_name' => 'සිංහල vlog.mp4', 'file_size' => strlen($bytes),
        ])->assertOk();
        $this->assertSame($uuid, $resume->json('data.upload.uuid'));
        $this->assertSame([0, 2], $resume->json('data.upload.received_chunks'));

        $this->withHeaders($headers)->postJson("/api/uploads/{$uuid}/complete")
            ->assertStatus(409)->assertJsonPath('errors.missing_chunks', [1]);

        $this->putChunk($headers, $uuid, 1, $chunks[1])->assertOk();
        $this->putChunk($headers, $uuid, 1, $chunks[1])->assertOk(); // retries are idempotent

        $this->withHeaders($headers)->postJson("/api/uploads/{$uuid}/complete")
            ->assertStatus(201)->assertJsonPath('data.status', 'uploaded');

        $media = MediaFile::where('project_id', $project->id)->firstOrFail();
        $this->assertSame('local', $media->disk);
        $this->assertSame($bytes, Storage::disk('local')->get($media->file_path));
        $this->assertSame('සිංහල vlog.mp4', $media->original_name);
        $this->assertStringNotContainsString('vlog', $media->file_path);
        $this->assertDirectoryDoesNotExist(storage_path("app/chunks/{$uuid}"));
        Queue::assertPushed(ProcessUploadedVideoJob::class);
    }

    public function test_chunks_with_wrong_size_or_index_are_rejected(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $uuid = $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'a.mp4', 'file_size' => 2000])->json('data.upload.uuid');

        $this->putChunk($headers, $uuid, 0, str_repeat('x', 10))->assertStatus(422);
        $this->putChunk($headers, $uuid, 9, str_repeat('x', 10))->assertStatus(422);
    }

    public function test_assembled_non_video_is_rejected(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $payload = str_repeat('<?php ', 100);
        $uuid = $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'x.mp4', 'file_size' => strlen($payload)])->json('data.upload.uuid');
        $this->putChunk($headers, $uuid, 0, $payload)->assertOk();

        $this->withHeaders($headers)->postJson("/api/uploads/{$uuid}/complete")->assertStatus(422)->assertJsonValidationErrors(['video']);
        $this->assertDatabaseCount('media_files', 0);
    }

    public function test_unsupported_extension_is_rejected_at_start(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => '../../shell.php', 'file_size' => 10])
            ->assertStatus(422)->assertJsonValidationErrors(['file_name']);
    }

    public function test_other_users_cannot_touch_an_upload_session(): void
    {
        [$owner] = $this->userWithToken();
        [, $intruder] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $owner->id]);
        $session = UploadSession::factory()->create(['project_id' => $project->id, 'user_id' => $owner->id]);

        $this->withHeaders($intruder)->getJson("/api/uploads/{$session->uuid}")->assertForbidden();
        $this->putChunk($intruder, $session->uuid, 0, 'abcd')->assertForbidden();
        $this->withHeaders($intruder)->postJson("/api/uploads/{$session->uuid}/complete")->assertForbidden();
        $this->withHeaders($intruder)->deleteJson("/api/uploads/{$session->uuid}")->assertForbidden();
        $this->withHeaders($intruder)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'a.mp4', 'file_size' => 10])->assertForbidden();
    }

    public function test_cancelled_upload_discards_chunks_and_rejects_more(): void
    {
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $uuid = $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'a.mp4', 'file_size' => 2000])->json('data.upload.uuid');
        $this->putChunk($headers, $uuid, 0, str_repeat('x', 1024))->assertOk();

        $this->withHeaders($headers)->deleteJson("/api/uploads/{$uuid}")->assertOk();

        $this->assertDirectoryDoesNotExist(storage_path("app/chunks/{$uuid}"));
        $this->putChunk($headers, $uuid, 1, str_repeat('x', 976))->assertStatus(410);
    }

    public function test_prune_command_removes_expired_sessions(): void
    {
        $session = UploadSession::factory()->create(['expires_at' => now()->subDay()]);
        $session->forceFill(['updated_at' => now()->subHours(3)])->saveQuietly();
        File::ensureDirectoryExists($session->chunkDirectory());

        $this->artisan('uploads:prune')->assertSuccessful();

        $this->assertModelMissing($session);
        $this->assertDirectoryDoesNotExist($session->chunkDirectory());
    }
}
