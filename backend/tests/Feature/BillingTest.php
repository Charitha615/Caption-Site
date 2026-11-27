<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReceived;
use App\Notifications\PaymentReviewed;
use App\Notifications\ProEndingSoon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
        config([
            'billing.bank' => ['bank_name' => 'Commercial Bank', 'account_name' => 'Sinsub', 'account_number' => '1234567890', 'branch' => 'Colombo'],
            'billing.whatsapp' => '075 517 3298',
        ]);
    }

    /** Sanctum caches the signed-in user for the whole test; reset it so each call is really these headers' user. */
    private function as(array $headers): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeaders($headers);
    }

    private function admin(): array
    {
        return $this->userWithToken(['role' => 'admin']);
    }

    public function test_billing_page_shows_prices_bank_details_and_whatsapp(): void
    {
        [, $headers] = $this->userWithToken();

        $this->as($headers)->getJson('/api/billing')
            ->assertOk()
            ->assertJsonPath('data.plan.key', 'free')
            ->assertJsonPath('data.billing.prices', ['monthly' => 490, 'yearly' => 3990])
            ->assertJsonPath('data.billing.currency', 'LKR')
            ->assertJsonPath('data.billing.bank.account_number', '1234567890')
            ->assertJsonPath('data.billing.bank_ready', true)
            ->assertJsonPath('data.billing.whatsapp_link', 'https://wa.me/94755173298');

        // The same reference every time, so it can be shown before paying.
        $reference = $this->as($headers)->getJson('/api/billing')->json('data.billing.reference');
        $this->assertMatchesRegularExpression('/^SS-[2-9A-HJ-NP-Z]{6}$/', $reference);
        $this->assertSame($reference, $this->as($headers)->getJson('/api/billing')->json('data.billing.reference'));
    }

    public function test_user_submits_a_payment_with_a_slip_and_admins_are_told(): void
    {
        [$user, $headers] = $this->userWithToken();
        $admin = User::factory()->create(['role' => 'admin']);

        $res = $this->as($headers)->post('/api/billing/payments', [
            'period' => 'yearly',
            'slip' => UploadedFile::fake()->image('slip.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $res->assertJsonPath('data.payment.amount', 3990)
            ->assertJsonPath('data.payment.status', 'pending')
            ->assertJsonPath('data.payment.has_slip', true);
        $this->assertMatchesRegularExpression('/^SS-[2-9A-HJ-NP-Z]{6}$/', $res->json('data.payment.reference'));
        $this->assertArrayNotHasKey('slip_path', $res->json('data.payment'));
        Storage::disk('local')->assertExists(Payment::first()->slip_path);
        Notification::assertSentTo($admin, PaymentReceived::class);
        $this->assertSame('free', $user->fresh()->planKey());
    }

    public function test_only_one_payment_can_wait_at_a_time_and_bad_input_is_refused(): void
    {
        [, $headers] = $this->userWithToken();

        $this->as($headers)->postJson('/api/billing/payments', ['period' => 'weekly'])->assertStatus(422)->assertJsonValidationErrors('period');
        $this->as($headers)->post('/api/billing/payments', ['period' => 'monthly', 'slip' => UploadedFile::fake()->create('slip.exe', 10)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('slip');

        $this->as($headers)->postJson('/api/billing/payments', ['period' => 'monthly', 'note' => 'Sent on WhatsApp'])->assertCreated();
        $this->as($headers)->postJson('/api/billing/payments', ['period' => 'monthly'])->assertStatus(422);
    }

    public function test_approval_turns_pro_on_for_the_period_and_renewing_early_adds_on(): void
    {
        $this->travelTo(now()->startOfDay());
        [$user, $headers] = $this->userWithToken();
        [, $adminHeaders] = $this->admin();

        $first = $this->as($headers)->postJson('/api/billing/payments', ['period' => 'monthly'])->json('data.payment.uuid');
        $this->as($adminHeaders)->postJson("/api/admin/payments/{$first}/approve")->assertOk();

        $user->refresh();
        $this->assertSame('pro', $user->planKey());
        $this->assertTrue($user->plan_expires_at->equalTo(now()->addMonth()));
        Notification::assertSentTo($user, PaymentReviewed::class);
        $this->as($headers)->getJson('/api/usage')->assertJsonPath('data.usage.plan.key', 'pro')->assertJsonPath('data.usage.features.watermark', false);

        // Renewing a yearly plan before the month ends: the year starts when the month ends.
        $second = $this->as($headers)->postJson('/api/billing/payments', ['period' => 'yearly'])->json('data.payment.uuid');
        $this->as($adminHeaders)->postJson("/api/admin/payments/{$second}/approve")->assertOk();
        $this->assertTrue($user->fresh()->plan_expires_at->equalTo(now()->addMonth()->addYear()));

        $this->as($adminHeaders)->postJson("/api/admin/payments/{$second}/approve")->assertStatus(422);
    }

    public function test_pro_ends_on_its_end_date(): void
    {
        $user = User::factory()->pro()->create();
        $this->assertSame('pro', $user->planKey());

        $this->travel(32)->days();
        $this->assertSame('free', $user->fresh()->planKey());
        $this->assertFalse($user->fresh()->hasFeature('premium_styles'));
    }

    public function test_rejection_keeps_the_user_on_free_and_says_why(): void
    {
        [$user, $headers] = $this->userWithToken();
        [, $adminHeaders] = $this->admin();
        $uuid = $this->as($headers)->postJson('/api/billing/payments', ['period' => 'monthly'])->json('data.payment.uuid');

        $this->as($adminHeaders)->postJson("/api/admin/payments/{$uuid}/reject", [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->as($adminHeaders)->postJson("/api/admin/payments/{$uuid}/reject", ['reason' => 'No transfer found'])
            ->assertOk()->assertJsonPath('data.payment.status', 'rejected');

        $this->assertSame('free', $user->fresh()->planKey());
        $this->as($headers)->getJson('/api/billing')->assertJsonPath('data.payments.0.admin_note', 'No transfer found');
    }

    public function test_only_admins_review_payments_and_slips_stay_private(): void
    {
        [, $headers] = $this->userWithToken();
        [, $otherHeaders] = $this->userWithToken();
        [, $adminHeaders] = $this->admin();
        $uuid = $this->as($headers)->post('/api/billing/payments', ['period' => 'monthly', 'slip' => UploadedFile::fake()->image('slip.png')], ['Accept' => 'application/json'])->json('data.payment.uuid');

        $this->as($otherHeaders)->getJson('/api/admin/payments')->assertForbidden();
        $this->as($otherHeaders)->postJson("/api/admin/payments/{$uuid}/approve")->assertForbidden();
        $this->as($otherHeaders)->get("/api/billing/payments/{$uuid}/slip")->assertNotFound();

        $this->as($headers)->get("/api/billing/payments/{$uuid}/slip")->assertOk();
        $this->as($adminHeaders)->get("/api/billing/payments/{$uuid}/slip")->assertOk();
        $this->as($adminHeaders)->getJson('/api/admin/payments')
            ->assertOk()->assertJsonPath('data.payments.0.uuid', $uuid)->assertJsonPath('data.counts.pending', 1);
    }

    public function test_reminder_goes_out_once_before_pro_ends(): void
    {
        $soon = User::factory()->create(['plan' => 'pro', 'plan_expires_at' => now()->addDays(3)]);
        $later = User::factory()->create(['plan' => 'pro', 'plan_expires_at' => now()->addDays(20)]);

        $this->artisan('billing:pro-reminders')->assertSuccessful();
        $this->artisan('billing:pro-reminders')->assertSuccessful();

        Notification::assertSentToTimes($soon, ProEndingSoon::class, 1);
        Notification::assertNotSentTo($later, ProEndingSoon::class);
    }
}
