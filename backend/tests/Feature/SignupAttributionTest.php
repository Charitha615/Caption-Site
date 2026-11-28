<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SignupAttributionTest extends TestCase
{
    use RefreshDatabase;

    private function register(?array $attribution = null): TestResponse
    {
        return $this->postJson('/api/auth/register', array_filter([
            'name' => 'Nimal',
            'email' => 'nimal@example.com',
            'password' => 'secret123',
            'attribution' => $attribution,
        ]));
    }

    public function test_registration_stores_the_utm_tags(): void
    {
        $this->register(['source' => ' TikTok ', 'medium' => 'social', 'campaign' => 'launch-dec', 'referrer' => 'https://www.tiktok.com/@sinsub'])
            ->assertCreated();

        $user = User::where('email', 'nimal@example.com')->firstOrFail();
        $this->assertSame('tiktok', $user->signup_source);
        $this->assertSame('social', $user->signup_medium);
        $this->assertSame('launch-dec', $user->signup_campaign);
        $this->assertSame('tiktok.com', $user->signup_referrer);
    }

    public function test_a_referring_site_without_utm_tags_counts_as_a_referral(): void
    {
        $this->register(['referrer' => 'https://m.facebook.com/'])->assertCreated();

        $user = User::where('email', 'nimal@example.com')->firstOrFail();
        $this->assertSame('m.facebook.com', $user->signup_source);
        $this->assertSame('referral', $user->signup_medium);
    }

    public function test_registration_without_attribution_still_works(): void
    {
        $this->register()->assertCreated();

        $this->assertNull(User::where('email', 'nimal@example.com')->value('signup_source'));
    }

    public function test_unknown_or_oversized_attribution_is_rejected(): void
    {
        $this->register(['source' => str_repeat('a', 101)])->assertJsonValidationErrors('attribution.source');
        $this->register(['source' => 'x', 'plan' => 'pro'])->assertJsonValidationErrors('attribution');
    }

    public function test_google_sign_up_stores_attribution_but_a_returning_user_keeps_theirs(): void
    {
        config(['services.google.client_id' => 'cid']);
        Http::fake([
            GoogleTokenVerifier::TOKENINFO_URL.'*' => Http::response(['aud' => 'cid', 'azp' => 'cid', 'scope' => 'openid email profile', 'expires_in' => 3599]),
            GoogleTokenVerifier::USERINFO_URL => Http::response(['sub' => '1', 'email' => 'kasun@gmail.com', 'email_verified' => true, 'name' => 'Kasun', 'picture' => null]),
        ]);
        $token = 'ya29.test-access-token-1234567890';

        $this->postJson('/api/auth/google', ['access_token' => $token, 'attribution' => ['source' => 'facebook', 'campaign' => 'launch']])->assertCreated();
        $this->postJson('/api/auth/google', ['access_token' => $token, 'attribution' => ['source' => 'youtube']])->assertOk();

        $user = User::where('email', 'kasun@gmail.com')->firstOrFail();
        $this->assertSame('facebook', $user->signup_source);
        $this->assertSame('launch', $user->signup_campaign);
    }

    public function test_admin_sees_sign_ups_and_paid_users_by_source(): void
    {
        [, $headers] = $this->userWithToken(['role' => 'admin', 'signup_source' => null]);
        $tiktok = User::factory()->count(3)->create(['signup_source' => 'tiktok', 'signup_medium' => 'social', 'signup_campaign' => 'launch']);
        User::factory()->create(['signup_source' => 'facebook', 'signup_medium' => 'social', 'signup_campaign' => 'launch']);
        User::factory()->create(['signup_source' => 'tiktok', 'created_at' => now()->subDays(60)]);
        Payment::factory()->approved()->create(['user_id' => $tiktok[0]->id]);
        Payment::factory()->create(['user_id' => $tiktok[1]->id]);

        $this->withHeaders($headers)->getJson('/api/admin/signups?days=30')
            ->assertOk()
            ->assertJsonPath('data.totals', ['signups' => 5, 'paid' => 1, 'tracked' => 4])
            ->assertJsonPath('data.sources.0', ['source' => 'tiktok', 'medium' => 'social', 'campaign' => 'launch', 'link_name' => null, 'signups' => 3, 'paid' => 1]);

        $this->withHeaders($headers)->getJson('/api/admin/signups?days=0')->assertJsonPath('data.totals.signups', 6);
    }

    public function test_only_admins_can_see_sign_up_sources(): void
    {
        [, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->getJson('/api/admin/signups')->assertForbidden();
    }
}
