<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Billing\BillingService;
use App\Services\Billing\TrialService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** The free 7-day Pro trial: once per email, for Free accounts that never paid. */
class TrialTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_free_account_starts_a_7_day_pro_trial_once(): void
    {
        $this->travelTo(Carbon::parse('2026-12-01 10:00:00'));
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->getJson('/api/usage')
            ->assertJsonPath('data.usage.trial.eligible', true)
            ->assertJsonPath('data.usage.trial.days', 7);

        $this->withHeaders($headers)->postJson('/api/billing/trial')->assertCreated()->assertJsonPath('data.days', 7);
        $user->refresh();
        $this->assertSame('pro', $user->planKey());
        $this->assertTrue($user->plan_expires_at->equalTo(Carbon::parse('2026-12-08 10:00:00')));
        $this->assertSame('plan', $user->notifications()->first()->data['kind']);

        $this->app['auth']->forgetGuards();
        $this->withHeaders($headers)->getJson('/api/usage')
            ->assertJsonPath('data.usage.plan.key', 'pro')
            ->assertJsonPath('data.usage.trial.active', true)
            ->assertJsonPath('data.usage.trial.eligible', false);
        $this->withHeaders($headers)->postJson('/api/billing/trial')->assertUnprocessable()->assertJsonValidationErrors('trial');

        // After 7 days: back on Free, and no second trial.
        $this->travelTo(Carbon::parse('2026-12-08 10:01:00'));
        $this->assertSame('free', $user->fresh()->planKey());
        $this->app['auth']->forgetGuards();
        $this->withHeaders($headers)->getJson('/api/usage')
            ->assertJsonPath('data.usage.trial.active', false)
            ->assertJsonPath('data.usage.trial.used', true)
            ->assertJsonPath('data.usage.trial.eligible', false);
        $this->withHeaders($headers)->postJson('/api/billing/trial')->assertUnprocessable();
    }

    public function test_the_same_email_cannot_get_a_second_trial_with_a_new_account(): void
    {
        $first = User::factory()->create(['email' => 'nimal.perera@gmail.com']);
        app(TrialService::class)->start($first);
        $first->forceDelete();

        [, $headers] = $this->userWithToken(['email' => 'nimalperera+again@googlemail.com']);
        $this->withHeaders($headers)->postJson('/api/billing/trial')->assertUnprocessable()
            ->assertJsonFragment(['trial' => ['A free trial was already used with this email address.']]);

        $this->assertSame('nimalperera@gmail.com', TrialService::normalizeEmail('Nimal.Perera+x@GoogleMail.com'));
        $this->assertSame('a.b+c@example.com', TrialService::normalizeEmail('A.B+c@Example.com'));
    }

    public function test_pro_and_past_payers_are_not_eligible_and_paying_during_a_trial_keeps_the_trial_days(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $billing = app(BillingService::class);
        $trials = app(TrialService::class);

        $pro = User::factory()->pro()->create();
        $this->assertSame('You already have Pro.', $trials->ineligibleReason($pro));

        $payer = User::factory()->create();
        $billing->approve($billing->submit($payer, 'monthly', null, null), $admin);
        $payer->forceFill(['plan_expires_at' => now()->subDay()])->save();
        $this->assertSame('The free trial is for people new to Pro.', $trials->ineligibleReason($payer->fresh()));

        Notification::fake();
        $this->travelTo(Carbon::parse('2026-12-01 10:00:00'));
        $user = User::factory()->create();
        $trials->start($user);
        $this->travelTo(Carbon::parse('2026-12-03 10:00:00'));
        $billing->approve($billing->submit($user->fresh(), 'monthly', null, null), $admin);
        $user->refresh();
        // 30 paid days start after the trial's end on 8 December.
        $this->assertTrue($user->plan_expires_at->equalTo(Carbon::parse('2027-01-07 10:00:00')));
        $this->assertFalse($trials->isOnTrial($user));
    }

    public function test_the_trial_reminder_comes_the_day_before_it_ends(): void
    {
        Notification::fake();
        $this->travelTo(Carbon::parse('2026-12-01 10:00:00'));
        $user = User::factory()->create();
        app(TrialService::class)->start($user);

        $this->travelTo(Carbon::parse('2026-12-04 09:00:00'));
        $this->artisan('billing:pro-reminders')->assertSuccessful();
        $this->assertNull($user->fresh()->plan_reminded_at);

        $this->travelTo(Carbon::parse('2026-12-07 12:00:00'));
        $this->artisan('billing:pro-reminders')->assertSuccessful();
        $this->assertNotNull($user->fresh()->plan_reminded_at);
    }
}
