<?php

namespace Tests\Feature;

use App\Models\MediaFile;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaStreamTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_video_url_is_a_signed_range_capable_stream(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('media/v.mp4', str_repeat('0123456789', 100));
        $user = User::factory()->create();
        $project = Project::factory()->create(['user_id' => $user->id]);
        MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/v.mp4', 'file_name' => 'v.mp4', 'original_name' => 'v.mp4', 'disk' => 'public', 'mime_type' => 'video/mp4', 'file_size' => 1000]);

        $url = $this->withHeader('Authorization', 'Bearer '.$user->createToken('t')->plainTextToken)
            ->getJson("/api/projects/{$project->uuid}")->json('data.project.video_url');

        $this->assertStringContainsString('/api/media/', $url);
        $this->assertStringContainsString('signature=', $url);
        $this->assertStringNotContainsString('media/v.mp4', $url, 'storage path not exposed');

        $partial = $this->withHeader('Range', 'bytes=10-19')->get($url);
        $partial->assertStatus(206);
        $this->assertSame('bytes 10-19/1000', $partial->headers->get('Content-Range'));

        $unsigned = explode('?', $url)[0];
        $this->withoutHeader('Range')->getJson($unsigned)->assertStatus(403);
    }

    public function test_legacy_public_media_can_be_moved_to_private_storage(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        Storage::disk('public')->put('media/old.mp4', 'video-bytes');
        Storage::disk('public')->put('thumbnails/t.jpg', 'jpeg');
        $project = Project::factory()->create(['thumbnail' => '/storage/thumbnails/t.jpg']);
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/old.mp4', 'file_name' => 'old.mp4', 'original_name' => 'old.mp4', 'disk' => 'public', 'mime_type' => 'video/mp4', 'file_size' => 11]);

        $this->artisan('media:make-private')->assertSuccessful();

        Storage::disk('public')->assertMissing('media/old.mp4');
        Storage::disk('local')->assertExists('media/old.mp4');
        Storage::disk('local')->assertExists("thumbnails/{$project->uuid}.jpg");
        $this->assertSame('local', $media->fresh()->disk);
        $this->assertSame("thumbnails/{$project->uuid}.jpg", $project->fresh()->thumbnail);
    }
}
