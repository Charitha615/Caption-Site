<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_profile_with_unicode_name(): void
    {
        [$user, $headers] = $this->userWithToken();

        $this->withHeaders($headers)->patchJson('/api/me', ['name' => 'චරිත', 'email' => 'NEW@Example.com'])
            ->assertOk()
            ->assertJsonPath('data.user.name', 'චරිත')
            ->assertJsonPath('data.user.email', 'new@example.com');
    }

    public function test_email_must_be_unique(): void
    {
        [, $headers] = $this->userWithToken();
        [$other] = $this->userWithToken();

        $this->withHeaders($headers)->patchJson('/api/me', ['email' => $other->email])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_password_change_requires_current_password_and_revokes_other_tokens(): void
    {
        [$user, $headers] = $this->userWithToken(['password' => Hash::make('oldpass123')]);
        $user->createToken('other-device');

        $this->withHeaders($headers)->putJson('/api/me/password', ['current_password' => 'wrong', 'password' => 'newpass123', 'password_confirmation' => 'newpass123'])
            ->assertStatus(422)->assertJsonValidationErrors(['current_password']);

        $this->withHeaders($headers)->putJson('/api/me/password', ['current_password' => 'oldpass123', 'password' => 'newpass123', 'password_confirmation' => 'newpass123'])
            ->assertOk();

        $this->assertTrue(Hash::check('newpass123', $user->fresh()->password));
        $this->assertSame(1, $user->tokens()->count(), 'only the current session survives');
    }

    public function test_weak_passwords_are_rejected_on_register(): void
    {
        $this->postJson('/api/auth/register', ['name' => 'A', 'email' => 'a@example.com', 'password' => 'aaaaaaaa'])
            ->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertStatus(429)
            ->assertJsonPath('code', 'rate_limited')
            ->assertHeader('Retry-After');
    }
}
