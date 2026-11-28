<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SessionTest extends TestCase
{
    use RefreshDatabase;

    private const CHROME_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

    /** Signs in through the real login endpoint, from the given browser and IP address. */
    private function signIn(User $user, string $userAgent, string $ip): string
    {
        return $this->withHeaders(['User-Agent' => $userAgent])
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123'])
            ->assertOk()
            ->json('data.token');
    }

    public function test_lists_signed_in_devices_with_browser_ip_and_times(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123')]);
        $this->signIn($user, self::SAFARI_IPHONE, '203.0.113.7');
        $laptop = $this->signIn($user, self::CHROME_WINDOWS, '198.51.100.20');

        $sessions = $this->withToken($laptop)->getJson('/api/me/sessions')
            ->assertOk()
            ->assertJsonCount(2, 'data.sessions')
            ->json('data.sessions');

        $current = collect($sessions)->firstWhere('current', true);
        $this->assertSame(['Chrome', 'Windows', 'desktop', '198.51.100.20', 'password'], [$current['browser'], $current['os'], $current['device'], $current['ip_address'], $current['sign_in_method']]);
        $this->assertNotNull($current['signed_in_at']);
        $this->assertNotNull($current['last_active_at']);

        $phone = collect($sessions)->firstWhere('current', false);
        $this->assertSame(['Safari', 'iPhone', 'mobile', '203.0.113.7'], [$phone['browser'], $phone['os'], $phone['device'], $phone['ip_address']]);
        $this->assertArrayNotHasKey('token', $phone);
    }

    public function test_signing_in_again_on_the_same_device_replaces_its_old_session(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123')]);
        $login = fn (string $device, string $ip = '198.51.100.20') => $this->withHeaders(['User-Agent' => self::CHROME_WINDOWS])
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123', 'device_id' => $device])
            ->assertOk()->json('data.token');

        $first = $login('browser-aaaaaaaaaaaaaaaa');
        $this->travel(5)->minutes();
        $again = $login('browser-aaaaaaaaaaaaaaaa', '203.0.113.99'); // same browser, new network
        $login('browser-bbbbbbbbbbbbbbbb');                          // a second browser, same model and network

        $this->assertSame(2, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($first)->getJson('/api/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $sessions = $this->withToken($again)->getJson('/api/me/sessions')->assertOk()->json('data.sessions');
        $this->assertSame('203.0.113.99', collect($sessions)->firstWhere('current', true)['ip_address']);
    }

    public function test_sessions_from_before_device_ids_are_matched_by_browser_and_ip(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123')]);
        $this->signIn($user, self::CHROME_WINDOWS, '198.51.100.20');
        $this->signIn($user, self::SAFARI_IPHONE, '198.51.100.20');

        $this->withHeaders(['User-Agent' => self::CHROME_WINDOWS])->withServerVariables(['REMOTE_ADDR' => '198.51.100.20'])
            ->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password123', 'device_id' => 'browser-cccccccccccccccc'])->assertOk();

        $this->assertSame(2, $user->tokens()->count());
        $this->assertSame(['browser-cccccccccccccccc', null], $user->tokens()->orderBy('device_id', 'desc')->pluck('device_id')->all());
        $this->assertSame(1, $user->tokens()->where('user_agent', self::SAFARI_IPHONE)->count());
    }

    public function test_signing_out_one_device_ends_only_that_sign_in(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123')]);
        $this->signIn($user, self::SAFARI_IPHONE, '203.0.113.7');
        $laptop = $this->signIn($user, self::CHROME_WINDOWS, '198.51.100.20');
        $phoneId = $user->tokens()->where('ip_address', '203.0.113.7')->value('id');

        $this->withToken($laptop)->deleteJson("/api/me/sessions/{$phoneId}")->assertOk();

        $this->assertSame(['198.51.100.20'], $user->tokens()->pluck('ip_address')->all());
    }

    public function test_sign_out_all_other_devices_keeps_this_one(): void
    {
        $user = User::factory()->create(['password' => Hash::make('password123')]);
        $this->signIn($user, self::SAFARI_IPHONE, '203.0.113.7');
        $this->signIn($user, self::SAFARI_IPHONE, '203.0.113.8');
        $laptop = $this->signIn($user, self::CHROME_WINDOWS, '198.51.100.20');

        $this->withToken($laptop)->deleteJson('/api/me/sessions')
            ->assertOk()
            ->assertJsonPath('data.signed_out', 2);

        $this->assertSame(['198.51.100.20'], $user->tokens()->pluck('ip_address')->all());
    }

    public function test_cannot_see_or_sign_out_another_users_devices(): void
    {
        [, $headers] = $this->userWithToken();
        [$other] = $this->userWithToken();
        $otherTokenId = $other->tokens()->value('id');

        $this->withHeaders($headers)->getJson('/api/me/sessions')->assertOk()->assertJsonCount(1, 'data.sessions');
        $this->withHeaders($headers)->deleteJson("/api/me/sessions/{$otherTokenId}")->assertNotFound();
        $this->assertSame(1, $other->tokens()->count());
    }

    public function test_sessions_require_sign_in(): void
    {
        $this->getJson('/api/me/sessions')->assertUnauthorized();
    }
}
