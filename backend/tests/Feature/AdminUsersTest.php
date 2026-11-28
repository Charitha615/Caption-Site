<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\Usage\UsageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** Admin Users page: list everyone, change plans (incl. the unsold Unlimited plan), reset accounts. */
class AdminUsersTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{0: User, 1: array<string, string>} */
    private function admin(): array
    {
        return $this->userWithToken(['role' => 'admin']);
    }

    public function test_only_admins_can_use_the_users_pages(): void
    {
        [, $headers] = $this->userWithToken();
        $other = User::factory()->create();

        $this->withHeaders($headers)->getJson('/api/admin/users')->assertForbidden();
        $this->withHeaders($headers)->putJson("/api/admin/users/{$other->uuid}/plan", ['plan' => 'unlimited'])->assertForbidden();
        $this->assertNotSame('unlimited', $other->refresh()->plan);
    }

    public function test_lists_users_with_their_current_plan_and_filters_by_plan(): void
    {
        [, $headers] = $this->admin();
        $pro = User::factory()->pro()->create(['name' => 'Nimal Pro']);
        $lapsed = User::factory()->create(['plan' => 'pro', 'plan_expires_at' => now()->subDay()]);

        $users = $this->withHeaders($headers)->getJson('/api/admin/users')->assertOk()->json('data.users');
        $this->assertCount(3, $users);
        $this->assertSame('free', collect($users)->firstWhere('uuid', $lapsed->uuid)['plan']);

        $this->withHeaders($headers)->getJson('/api/admin/users?plan=pro')->assertOk()
            ->assertJsonCount(1, 'data.users')->assertJsonPath('data.users.0.uuid', $pro->uuid);
        $this->withHeaders($headers)->getJson('/api/admin/users?search=Nimal')->assertJsonCount(1, 'data.users');
        $this->withHeaders($headers)->getJson('/api/admin/users?plan=free')->assertJsonMissing(['uuid' => $pro->uuid]);
    }

    public function test_admin_can_give_unlimited_with_no_end_date_and_it_has_no_limits(): void
    {
        [, $headers] = $this->admin();
        $user = User::factory()->create();

        $this->withHeaders($headers)->putJson("/api/admin/users/{$user->uuid}/plan", ['plan' => 'unlimited'])
            ->assertOk()->assertJsonPath('data.user.plan', 'unlimited')->assertJsonPath('data.user.plan_expires_at', null);

        $usage = app(UsageService::class)->summary($user->refresh());
        $this->assertNull($usage['caption_minutes']['limit']);
        $this->assertNull($usage['renders']['limit']);
        $this->assertTrue($usage['features']['premium_styles']);

        $this->withHeaders($headers)->putJson("/api/admin/users/{$user->uuid}/plan", ['plan' => 'pro', 'expires_at' => now()->addDays(10)->toDateString()])
            ->assertOk()->assertJsonPath('data.user.plan', 'pro');
        $this->assertTrue($user->refresh()->plan_expires_at->isSameDay(now()->addDays(10)));

        $this->withHeaders($headers)->putJson("/api/admin/users/{$user->uuid}/plan", ['plan' => 'gold'])->assertUnprocessable();
    }

    public function test_unlimited_is_never_offered_for_sale(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->getJson('/api/billing')->assertOk()->assertJsonMissing(['plan' => 'unlimited']);
        $this->withHeaders($headers)->postJson('/api/billing/payments', ['period' => 'monthly', 'plan' => 'unlimited', 'note' => 'x']);
        $this->assertDatabaseMissing('payments', ['plan' => 'unlimited']);
    }

    public function test_reset_password_signs_the_user_out_everywhere(): void
    {
        [, $headers] = $this->admin();
        $user = User::factory()->create();
        $user->createToken('phone');

        $this->withHeaders($headers)->putJson("/api/admin/users/{$user->uuid}/password", ['password' => 'short'])->assertUnprocessable();
        $this->withHeaders($headers)->putJson("/api/admin/users/{$user->uuid}/password", ['password' => 'newpass123'])->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->refresh()->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_reset_usage_gives_a_fresh_month_but_keeps_the_records(): void
    {
        [, $headers] = $this->admin();
        $user = User::factory()->create();
        app(UsageService::class)->record($user, UsageRecord::ACTION_CAPTION_GENERATION, 600, 'seconds');
        $this->travel(1)->seconds();

        $this->withHeaders($headers)->postJson("/api/admin/users/{$user->uuid}/usage-reset")
            ->assertOk()->assertJsonPath('data.user.usage.caption_minutes.used', 0);
        $this->assertSame(1, UsageRecord::where('user_id', $user->id)->count());
    }

    public function test_sign_out_and_delete_projects(): void
    {
        [, $headers] = $this->admin();
        $user = User::factory()->create();
        $user->createToken('a');
        $user->createToken('b');
        Project::factory()->count(2)->create(['user_id' => $user->id]);
        $kept = Project::factory()->create();

        $this->withHeaders($headers)->postJson("/api/admin/users/{$user->uuid}/sign-out")->assertOk()->assertJsonPath('data.sessions', 2);
        $this->withHeaders($headers)->deleteJson("/api/admin/users/{$user->uuid}/projects")->assertOk()->assertJsonPath('data.projects', 2);

        $this->assertSame(0, Project::where('user_id', $user->id)->count());
        $this->assertNotNull($kept->fresh());
        $this->assertNotNull($user->fresh());
    }
}
