<?php

namespace Tests\Feature;

use App\Models\Caption;
use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/**
 * One user must never read or change another user's projects, videos, captions,
 * exports, uploads, settings or usage — whatever URL they construct.
 */
class CrossUserAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_project_scoped_endpoint_rejects_other_users(): void
    {
        Storage::fake('local');
        [$owner] = $this->userWithToken();
        [, $intruder] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $owner->id, 'status' => Project::STATUS_READY]);
        $caption = Caption::create(['project_id' => $project->id, 'sequence' => 1, 'start_time' => 0, 'end_time' => 1, 'text' => 'secret']);
        $export = Export::create(['project_id' => $project->id, 'user_id' => $owner->id, 'type' => 'srt', 'status' => 'completed', 'file_path' => 'exports/x.srt']);
        $p = "/api/projects/{$project->uuid}";

        $calls = [
            ['getJson', $p], ['patchJson', $p], ['deleteJson', $p], ['getJson', "{$p}/status"],
            ['getJson', "{$p}/captions"], ['postJson', "{$p}/captions"], ['putJson', "{$p}/captions/sync"],
            ['patchJson', "{$p}/captions/{$caption->uuid}"], ['deleteJson', "{$p}/captions/{$caption->uuid}"],
            ['postJson', "{$p}/generate-captions"], ['postJson', "{$p}/upload"], ['postJson', "{$p}/uploads"],
            ['getJson', "{$p}/exports"], ['postJson', "{$p}/exports"],
            ['getJson', "/api/exports/{$export->uuid}"], ['deleteJson', "/api/exports/{$export->uuid}"],
        ];
        foreach ($calls as [$method, $url]) {
            $this->withHeaders($intruder)->{$method}($url, ['type' => 'srt', 'captions' => [], 'start_time' => 0, 'end_time' => 1, 'text' => 'x', 'file_name' => 'a.mp4', 'file_size' => 1])
                ->assertForbidden();
        }

        $this->assertSame('secret', $caption->fresh()->text);
        $this->assertNotSoftDeleted($project);
        $this->assertNotSoftDeleted($export);
    }

    public function test_a_caption_cannot_be_edited_through_another_project_url(): void
    {
        [$user, $headers] = $this->userWithToken();
        [$victim] = $this->userWithToken();
        $mine = Project::factory()->create(['user_id' => $user->id]);
        $theirs = Project::factory()->create(['user_id' => $victim->id]);
        $caption = Caption::create(['project_id' => $theirs->id, 'sequence' => 1, 'start_time' => 0, 'end_time' => 1, 'text' => 'theirs']);

        // Scoped binding: the caption is looked up inside *my* project, so it is not found.
        $this->withHeaders($headers)->patchJson("/api/projects/{$mine->uuid}/captions/{$caption->uuid}", ['text' => 'hijack'])->assertNotFound();
        $this->withHeaders($headers)->deleteJson("/api/projects/{$mine->uuid}/captions/{$caption->id}")->assertNotFound();
        $this->assertSame('theirs', $caption->fresh()->text);
    }

    public function test_syncing_with_another_projects_caption_uuid_cannot_move_it(): void
    {
        [$user, $headers] = $this->userWithToken();
        [$victim] = $this->userWithToken();
        $mine = Project::factory()->create(['user_id' => $user->id]);
        $theirs = Project::factory()->create(['user_id' => $victim->id]);
        $caption = Caption::create(['project_id' => $theirs->id, 'sequence' => 1, 'start_time' => 0, 'end_time' => 1, 'text' => 'theirs']);

        $this->withHeaders($headers)->putJson("/api/projects/{$mine->uuid}/captions/sync", [
            'captions' => [['uuid' => $caption->uuid, 'start_time' => 0, 'end_time' => 1, 'text' => 'mine']],
        ])->assertOk();

        $this->assertSame($theirs->id, $caption->fresh()->project_id);
        $this->assertSame('theirs', $caption->fresh()->text);
        $this->assertSame(1, Caption::where('project_id', $mine->id)->count());
    }

    public function test_settings_and_usage_are_per_user(): void
    {
        [, $a] = $this->userWithToken();
        [, $b] = $this->userWithToken();

        $this->withHeaders($a)->putJson('/api/settings', ['default_language' => 'en'])->assertOk();

        $this->withHeaders($a)->getJson('/api/settings')->assertJsonPath('data.settings.default_language', 'en');
        $this->app['auth']->forgetGuards(); // tests reuse one app instance; production resolves per request
        $this->withHeaders($b)->getJson('/api/settings')->assertJsonPath('data.settings.default_language', 'si');
        $this->withHeaders($a)->putJson('/api/settings', ['is_admin' => true, 'default_language' => 'xx'])->assertStatus(422);
    }

    public function test_media_urls_require_a_valid_signature_for_that_exact_file(): void
    {
        Storage::fake('local');
        [$owner] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $owner->id]);
        Storage::disk('local')->put('media/a.mp4', 'video');
        $media = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/a.mp4', 'file_name' => 'a.mp4', 'original_name' => 'a.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 5]);
        $other = MediaFile::create(['project_id' => $project->id, 'file_path' => 'media/b.mp4', 'file_name' => 'b.mp4', 'original_name' => 'b.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 5]);

        $signed = $media->streamUrl();
        $this->get($signed)->assertOk();
        $this->get(str_replace($media->uuid, $other->uuid, $signed))->assertForbidden();
        $this->get(URL::temporarySignedRoute('media.stream', now()->subMinute(), ['media' => $media->uuid]))->assertForbidden();
    }

    public function test_registration_cannot_grant_admin_role_or_paid_plan(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'Eve', 'email' => 'eve@example.com', 'password' => 'secret123', 'role' => 'admin', 'plan' => 'unlimited'])
            ->assertCreated()
            ->assertJsonPath('data.user.role', 'user')
            ->assertJsonPath('data.user.plan', 'free');
    }
}
