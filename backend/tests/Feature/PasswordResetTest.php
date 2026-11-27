<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\PasswordResetController;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_forgot_password_emails_a_link_to_the_frontend_reset_page(): void
    {
        Notification::fake();
        config(['brand.website' => 'https://app.example.test']);
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/auth/forgot-password', ['email' => '  Jane@Example.com '])
            ->assertOk()
            ->assertJson(['success' => true, 'message' => PasswordResetController::SENT_MESSAGE]);

        Notification::assertSentTo($user, ResetPasswordNotification::class, function (ResetPasswordNotification $n) use ($user) {
            $url = $n->toMail($user)->actionUrl;

            return str_starts_with($url, 'https://app.example.test/reset-password?token=')
                && str_contains($url, 'email=jane%40example.com');
        });
    }

    public function test_forgot_password_gives_the_same_answer_for_unknown_emails(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJson(['success' => true, 'message' => PasswordResetController::SENT_MESSAGE]);

        Notification::assertNothingSent();
    }

    public function test_forgot_password_requires_a_valid_email(): void
    {
        $this->postJson('/api/auth/forgot-password', ['email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_reset_sets_the_new_password_and_signs_out_every_device(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com', 'password' => 'OldPassword1']);
        $user->createToken('laptop');
        $user->createToken('phone');
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'NewPassword2',
            'password_confirmation' => 'NewPassword2',
        ])->assertOk()->assertJson(['success' => true]);

        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword2', $user->password));
        $this->assertSame(0, $user->tokens()->count());

        $this->postJson('/api/auth/login', ['email' => 'jane@example.com', 'password' => 'NewPassword2'])->assertOk();
    }

    public function test_a_reset_link_works_only_once(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);
        $payload = ['token' => $token, 'email' => 'jane@example.com', 'password' => 'NewPassword2', 'password_confirmation' => 'NewPassword2'];

        $this->postJson('/api/auth/reset-password', $payload)->assertOk();
        $this->postJson('/api/auth/reset-password', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('token');
    }

    public function test_reset_rejects_a_wrong_token(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com', 'password' => 'OldPassword1']);

        $this->postJson('/api/auth/reset-password', [
            'token' => 'wrong-token',
            'email' => 'jane@example.com',
            'password' => 'NewPassword2',
            'password_confirmation' => 'NewPassword2',
        ])->assertStatus(422)->assertJsonValidationErrors('token');

        $this->assertTrue(Hash::check('OldPassword1', $user->refresh()->password));
    }

    public function test_reset_enforces_the_password_rules(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);
        $token = Password::createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => 'jane@example.com',
            'password' => 'short',
            'password_confirmation' => 'different',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }
}
