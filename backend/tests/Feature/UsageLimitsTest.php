<?php

namespace Tests\Feature;

use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Services\Usage\UsageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UsageLimitsTest extends TestCase
{
    use RefreshDatabase;

    public function test_usage_endpoint_reports_plan_limits_and_consumption(): void
    {
        [$user, $headers] = $this->userWithToken();
        app(UsageService::class)->record($user, UsageRecord::ACTION_CAPTION_GENERATION, 600, 'seconds');
        app(UsageService::class)->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests');

        $this->withHeaders($headers)->getJson('/api/usage')
            ->assertOk()
            ->assertJsonPath('data.usage.plan.key', 'free')
            ->assertJsonPath('data.usage.caption_minutes.used', 10)
            ->assertJsonPath('data.usage.caption_minutes.limit', 120)
            ->assertJsonPath('data.usage.ai_requests_today.used', 1);

        $this->withHeaders($headers)->getJson('/api/dashboard')->assertJsonPath('data.summary.caption_minutes_limit', 120);
    }

    public function test_exhausted_caption_minutes_block_new_uploads_and_regeneration_with_402(): void
    {
        Storage::fake('local');
        Queue::fake();
        config(['plans.plans.free.caption_minutes_per_month' => 1]);
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id, 'status' => Project::STATUS_READY]);
        MediaFile::create(['project_id' => $project->id, 'file_path' => 'x.mp4', 'file_name' => 'x.mp4', 'original_name' => 'x.mp4', 'disk' => 'local', 'mime_type' => 'video/mp4', 'file_size' => 10, 'duration' => 30]);
        app(UsageService::class)->record($user, UsageRecord::ACTION_CAPTION_GENERATION, 60, 'seconds');

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/generate-captions")
            ->assertStatus(402)->assertJsonPath('code', 'usage_limit_exceeded');
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'a.mp4', 'file_size' => 100])
            ->assertStatus(402);
        Queue::assertNothingPushed();
    }

    public function test_upload_larger_than_plan_is_refused_before_any_bytes_are_sent(): void
    {
        config(['plans.plans.free.max_upload_mb' => 1]);
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/uploads", ['file_name' => 'big.mp4', 'file_size' => 5 * 1048576])
            ->assertStatus(402)->assertJsonPath('message', 'Videos on your plan can be up to 1 MB.');
    }

    public function test_export_limit_and_records(): void
    {
        config(['plans.plans.free.exports_per_month' => 1]);
        Storage::fake('local');
        [$user, $headers] = $this->userWithToken();
        $project = Project::factory()->create(['user_id' => $user->id]);

        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/exports", ['type' => 'srt'])->assertCreated();
        $this->assertSame(1, UsageRecord::where('action', UsageRecord::ACTION_EXPORT)->count());
        $this->withHeaders($headers)->postJson("/api/projects/{$project->uuid}/exports", ['type' => 'vtt'])->assertStatus(402);
        $this->assertSame(1, Export::count());
    }

    public function test_unlimited_plan_is_not_blocked(): void
    {
        [$user, $headers] = $this->userWithToken();
        $user->forceFill(['plan' => 'unlimited'])->save();
        app(UsageService::class)->record($user, UsageRecord::ACTION_CAPTION_GENERATION, 999999, 'seconds');

        app(UsageService::class)->ensureCaptionMinutesRemain($user->fresh(), 600);
        $this->withHeaders($headers)->getJson('/api/usage')->assertJsonPath('data.usage.caption_minutes.limit', null);
    }
}
