<?php

namespace Tests\Feature;

use App\Models\Caption;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use App\Services\AI\AIProviderInterface;
use App\Services\AI\GeminiAIProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VideoUploadAndCaptionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_user_can_upload_valid_video_file_to_own_project(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;

        $videoFile = UploadedFile::fake()->create('sample_recording.mp4', 5000, 'video/mp4');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/projects/{$project->uuid}/upload", [
                'video' => $videoFile,
                'language' => 'si',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'status' => 'uploaded',
                ],
            ]);

        // Verify media file created in database
        $this->assertDatabaseHas('media_files', [
            'project_id' => $project->id,
            'original_name' => 'sample_recording.mp4',
        ]);

        $mediaFile = MediaFile::where('project_id', $project->id)->first();
        $this->assertNotNull($mediaFile);

        // Security assertion: Safe internal UUID filename used, not client filename directly
        $this->assertNotEquals('sample_recording.mp4', $mediaFile->file_name);
        $this->assertStringEndsWith('.mp4', $mediaFile->file_name);

        // Verify file stored on public disk
        Storage::disk('public')->assertExists($mediaFile->file_path);
    }

    public function test_user_cannot_upload_video_to_another_users_project(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $projectB = Project::factory()->create(['user_id' => $userB->id]);
        $tokenA = $userA->createToken('test')->plainTextToken;

        $videoFile = UploadedFile::fake()->create('unauthorized.mp4', 1000, 'video/mp4');

        $response = $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->postJson("/api/projects/{$projectB->uuid}/upload", [
                'video' => $videoFile,
            ]);

        $response->assertStatus(403);
    }

    public function test_upload_rejects_invalid_mime_type_or_extension(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;

        // Uploading a text file pretending to be video
        $fakeFile = UploadedFile::fake()->create('malicious.php', 100, 'application/x-php');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/projects/{$project->uuid}/upload", [
                'video' => $fakeFile,
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['video']);
    }

    public function test_can_retrieve_project_processing_status(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create([
            'user_id' => $user->id,
            'status' => Project::STATUS_PROCESSING,
            'duration' => 75.5,
            'width' => 1920,
            'height' => 1080,
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/projects/{$project->uuid}/status");

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'uuid' => $project->uuid,
                    'status' => 'processing',
                    'progress_percentage' => 30,
                    'is_processing' => true,
                    'is_ready' => false,
                    'duration' => 75.5,
                ],
            ]);
    }

    public function test_caption_crud_lifecycle_and_ownership(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;

        // 1. Create caption
        $createRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson("/api/projects/{$project->uuid}/captions", [
                'start_time' => 1.5,
                'end_time' => 4.2,
                'text' => 'ආයුබෝවන්, අපගේ වීඩියෝවට සාදරයෙන් පිළිගනිමු.',
                'language' => 'si',
                'sequence' => 1,
                'metadata' => [
                    'words' => [
                        ['word' => 'ආයුබෝවන්,', 'start' => 1.5, 'end' => 2.3],
                        ['word' => 'අපගේ', 'start' => 2.4, 'end' => 2.8],
                        ['word' => 'වීඩියෝවට', 'start' => 2.9, 'end' => 3.5],
                        ['word' => 'සාදරයෙන්', 'start' => 3.5, 'end' => 4.0],
                        ['word' => 'පිළිගනිමු.', 'start' => 4.0, 'end' => 4.2],
                    ],
                ],
            ]);

        $createRes->assertStatus(201)
            ->assertJson([
                'success' => true,
                'data' => [
                    'caption' => [
                        'text' => 'ආයුබෝවන්, අපගේ වීඩියෝවට සාදරයෙන් පිළිගනිමු.',
                        'language' => 'si',
                        'sequence' => 1,
                    ],
                ],
            ]);

        $captionUuid = $createRes->json('data.caption.uuid');
        $this->assertNotEmpty($captionUuid);

        // 2. Retrieve captions list
        $listRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/projects/{$project->uuid}/captions");

        $listRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'count' => 1,
                ],
            ]);

        // 3. Update caption text & timings
        $updateRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->patchJson("/api/projects/{$project->uuid}/captions/{$captionUuid}", [
                'text' => 'ආයුබෝවන් මිතුරනි! SampleCap වෙත පිළිගනිමු.',
                'start_time' => 1.8,
            ]);

        $updateRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'caption' => [
                        'text' => 'ආයුබෝවන් මිතුරනි! SampleCap වෙත පිළිගනිමු.',
                        'start_time' => 1.8,
                    ],
                ],
            ]);

        // 4. Delete caption
        $deleteRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->deleteJson("/api/projects/{$project->uuid}/captions/{$captionUuid}");

        $deleteRes->assertStatus(200);

        // Verify soft-deleted
        $this->assertSoftDeleted('captions', [
            'uuid' => $captionUuid,
        ]);
    }

    public function test_user_cannot_modify_captions_of_another_users_project(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $projectB = Project::factory()->create(['user_id' => $userB->id]);
        $captionB = Caption::create([
            'project_id' => $projectB->id,
            'sequence' => 1,
            'start_time' => 0.0,
            'end_time' => 3.0,
            'text' => 'User B caption',
            'language' => 'en',
        ]);

        $tokenA = $userA->createToken('test')->plainTextToken;

        // Try to read
        $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->getJson("/api/projects/{$projectB->uuid}/captions")
            ->assertStatus(403);

        // Try to update
        $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->patchJson("/api/projects/{$projectB->uuid}/captions/{$captionB->uuid}", [
                'text' => 'Hacked caption',
            ])
            ->assertStatus(403);

        // Try to delete
        $this->withHeader('Authorization', "Bearer {$tokenA}")
            ->deleteJson("/api/projects/{$projectB->uuid}/captions/{$captionB->uuid}")
            ->assertStatus(403);
    }

    public function test_ai_provider_abstraction_generates_normalized_captions(): void
    {
        $provider = app(AIProviderInterface::class);
        $this->assertInstanceOf(GeminiAIProvider::class, $provider);

        // Test offline normalized generator with Sinhala
        $captions = $provider->generateCaptions('dummy_audio.mp3', 'si');

        $this->assertIsArray($captions);
        $this->assertNotEmpty($captions);

        $first = $captions[0];
        $this->assertArrayHasKey('start', $first);
        $this->assertArrayHasKey('end', $first);
        $this->assertArrayHasKey('text', $first);
        $this->assertArrayHasKey('language', $first);
        $this->assertArrayHasKey('words', $first);
        $this->assertEquals('si', $first['language']);
        $this->assertGreaterThan(0, count($first['words']));
    }

    public function test_caption_sync_endpoint_persists_full_timeline_batch(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;

        // Sync 3 captions at once
        $syncPayload = [
            'captions' => [
                [
                    'sequence' => 1,
                    'start_time' => 0.5,
                    'end_time' => 3.2,
                    'text' => 'පළමු පේළිය: ආයුබෝවන්',
                    'language' => 'si',
                ],
                [
                    'sequence' => 2,
                    'start_time' => 3.5,
                    'end_time' => 6.0,
                    'text' => 'දෙවන පේළිය: AI Captions',
                    'language' => 'si',
                ],
                [
                    'sequence' => 3,
                    'start_time' => 6.2,
                    'end_time' => 9.5,
                    'text' => 'තුන්වන පේළිය: SampleCap Studio',
                    'language' => 'si',
                ],
            ],
        ];

        $syncRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/projects/{$project->uuid}/captions/sync", $syncPayload);

        $syncRes->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'count' => 3,
                ],
            ]);

        $this->assertDatabaseCount('captions', 3);
        $this->assertDatabaseHas('captions', [
            'project_id' => $project->id,
            'text' => 'පළමු පේළිය: ආයුබෝවන්',
        ]);
    }

    public function test_caption_sync_restores_soft_deleted_caption_when_re_sent(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;
        $uuid = '0b7e6c1e-5d2a-4c8e-9a51-3f1d2e7b9c40';
        $caption = ['uuid' => $uuid, 'start_time' => 0, 'end_time' => 2, 'text' => 'ආයුබෝවන්', 'language' => 'si'];

        $sync = fn (array $captions) => $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/projects/{$project->uuid}/captions/sync", ['captions' => $captions]);

        $sync([$caption])->assertStatus(200);
        // Editor deletes every caption (empty list must be accepted)...
        $sync([])->assertStatus(200);
        $this->assertSoftDeleted('captions', ['uuid' => $uuid]);

        // ...then the user presses undo, which re-sends the same client UUID.
        $sync([$caption])->assertStatus(200)->assertJson(['data' => ['count' => 1]]);
        $this->assertNotSoftDeleted('captions', ['uuid' => $uuid]);
        $this->assertSame(1, Caption::withTrashed()->where('uuid', $uuid)->count());
    }

    public function test_caption_sync_accepts_empty_caption_text(): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/projects/{$project->uuid}/captions/sync", [
                'captions' => [['start_time' => 1, 'end_time' => 2, 'text' => '']],
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('captions', ['project_id' => $project->id, 'text' => '']);
    }
}
