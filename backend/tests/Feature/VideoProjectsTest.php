<?php

namespace Tests\Feature;

use App\Models\VideoProject;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Video editor projects saved to the account: layout only, per-plan limit, owner only. */
class VideoProjectsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function payload(string $name = 'Ella trip'): array
    {
        return [
            'name' => $name,
            'aspect' => '9:16',
            'data' => [
                'version' => 1,
                'tracks' => [['id' => 't1', 'kind' => 'video']],
                'clips' => [['id' => 'c1', 'start' => 2, 'duration' => 8.5], ['id' => 'c2', 'start' => 0, 'duration' => 3]],
                'media' => [['id' => 'm1', 'kind' => 'video', 'name' => 'ella.mp4', 'size' => 1234]],
                'fonts' => [],
            ],
            'thumb' => 'data:image/jpeg;base64,/9j/4AAQ',
        ];
    }

    public function test_save_list_open_update_and_delete(): void
    {
        [, $headers] = $this->userWithToken();

        $uuid = $this->withHeaders($headers)->postJson('/api/video-projects', $this->payload())->assertCreated()
            ->assertJsonPath('data.project.duration', 10.5)
            ->assertJsonPath('data.project.clip_count', 2)
            ->json('data.project.uuid');

        $this->withHeaders($headers)->getJson('/api/video-projects')->assertOk()
            ->assertJsonCount(1, 'data.projects')
            ->assertJsonPath('data.projects.0.name', 'Ella trip')
            ->assertJsonMissingPath('data.projects.0.data')
            ->assertJsonPath('data.limit', 5);
        $this->withHeaders($headers)->getJson("/api/video-projects/{$uuid}")->assertOk()
            ->assertJsonPath('data.project.data.media.0.name', 'ella.mp4');

        $this->withHeaders($headers)->putJson("/api/video-projects/{$uuid}", $this->payload('Ella trip v2'))->assertOk()->assertJsonPath('data.project.name', 'Ella trip v2');
        $this->withHeaders($headers)->deleteJson("/api/video-projects/{$uuid}")->assertOk();
        $this->assertSame(0, VideoProject::count());
    }

    public function test_free_keeps_five_projects_and_pro_more(): void
    {
        [$user, $headers] = $this->userWithToken();
        VideoProject::factory()->count(5)->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson('/api/video-projects', $this->payload())->assertStatus(402)->assertJsonPath('code', 'usage_limit_exceeded');

        $user->switchPlan('pro', now()->addMonth());
        $this->app['auth']->forgetGuards();
        $this->withHeaders($headers)->postJson('/api/video-projects', $this->payload())->assertCreated();
    }

    public function test_bad_input_and_other_peoples_projects_are_refused(): void
    {
        [, $headers] = $this->userWithToken();
        $theirs = VideoProject::factory()->create();

        $this->withHeaders($headers)->getJson("/api/video-projects/{$theirs->uuid}")->assertNotFound();
        $this->withHeaders($headers)->putJson("/api/video-projects/{$theirs->uuid}", $this->payload())->assertNotFound();
        $this->withHeaders($headers)->deleteJson("/api/video-projects/{$theirs->uuid}")->assertNotFound();
        $this->withHeaders($headers)->postJson('/api/video-projects', ['data' => ['version' => 2]] + $this->payload())->assertUnprocessable();
        $this->withHeaders($headers)->postJson('/api/video-projects', ['thumb' => 'javascript:alert(1)'] + $this->payload())->assertUnprocessable()->assertJsonValidationErrors('thumb');
        $this->assertSame(1, VideoProject::count());
    }
}
