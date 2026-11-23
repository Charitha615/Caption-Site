<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleLoginTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'test-client.apps.googleusercontent.com';

    private const TOKEN = 'ya29.test-access-token-1234567890';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.google.client_id' => self::CLIENT_ID]);
    }

    private function fakeGoogle(string $audience = self::CLIENT_ID, bool $emailVerified = true, string $email = 'kasun@gmail.com'): void
    {
        Http::fake([
            GoogleTokenVerifier::TOKENINFO_URL.'*' => Http::response(['aud' => $audience, 'azp' => $audience, 'scope' => 'openid email profile', 'expires_in' => 3599]),
            GoogleTokenVerifier::USERINFO_URL => Http::response(['sub' => '1098765', 'email' => $email, 'email_verified' => $emailVerified, 'name' => 'Kasun Silva', 'picture' => 'https://lh3.googleusercontent.com/a/photo']),
        ]);
    }

    public function test_a_new_google_user_gets_an_account_and_a_token(): void
    {
        $this->fakeGoogle();

        $this->postJson('/api/auth/google', ['access_token' => self::TOKEN])
            ->assertCreated()
            ->assertJsonPath('data.user.email', 'kasun@gmail.com')
            ->assertJsonPath('data.user.name', 'Kasun Silva')
            ->assertJsonStructure(['data' => ['token']]);

        $user = User::where('email', 'kasun@gmail.com')->firstOrFail();
        $this->assertSame('1098765', $user->google_id);
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame(config('plans.default'), $user->plan);
    }

    public function test_an_existing_account_with_the_same_email_is_linked_and_signed_in(): void
    {
        $existing = User::factory()->create(['email' => 'kasun@gmail.com', 'name' => 'Kasun']);
        $this->fakeGoogle();

        $this->postJson('/api/auth/google', ['access_token' => self::TOKEN])
            ->assertOk()
            ->assertJsonPath('data.user.name', 'Kasun');

        $this->assertSame('1098765', $existing->fresh()->google_id);
        $this->assertSame(1, User::count());
    }

    public function test_a_token_issued_to_another_app_is_rejected(): void
    {
        $this->fakeGoogle(audience: 'someone-elses-app.apps.googleusercontent.com');

        $this->postJson('/api/auth/google', ['access_token' => self::TOKEN])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('access_token');
        $this->assertSame(0, User::count());
    }

    public function test_an_unverified_google_email_is_rejected(): void
    {
        $this->fakeGoogle(emailVerified: false);

        $this->postJson('/api/auth/google', ['access_token' => self::TOKEN])->assertUnprocessable();
        $this->assertSame(0, User::count());
    }

    public function test_google_sign_in_reports_when_it_is_not_configured(): void
    {
        config(['services.google.client_id' => null]);
        Http::fake();

        $this->postJson('/api/auth/google', ['access_token' => self::TOKEN])
            ->assertStatus(503)
            ->assertJsonPath('errors.code.0', 'google_not_configured');
        Http::assertNothingSent();
    }
}
