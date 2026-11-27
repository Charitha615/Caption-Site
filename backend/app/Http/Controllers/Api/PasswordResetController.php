<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * "Forgot password": emails a one-time reset link, then sets a new password from it.
 * The link points at the frontend's /reset-password page (see AppServiceProvider).
 */
class PasswordResetController extends Controller
{
    use ApiResponseTrait;

    /** Same answer whether or not the email has an account, so the form can't be used to find accounts. */
    public const SENT_MESSAGE = 'If an account exists for that email, we have sent a link to reset the password.';

    public function sendLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);
        $email = strtolower(trim($validated['email']));

        $status = Password::sendResetLink(['email' => $email]);

        AppLog::info('auth.password_reset_requested', [
            'status' => $status,
            'ip' => $request->ip(),
        ]);

        return $this->successResponse(null, self::SENT_MESSAGE);
    }

    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ]);

        $status = Password::reset(
            [
                'email' => strtolower(trim($validated['email'])),
                'token' => $validated['token'],
                'password' => $validated['password'],
                'password_confirmation' => $request->input('password_confirmation'),
            ],
            function (User $user, string $password) {
                $user->forceFill(['password' => $password])->save();
                // Every signed-in device must sign in again with the new password.
                $user->tokens()->delete();
                AppLog::info('auth.password_reset', ['user' => $user->uuid]);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => 'This reset link is invalid or has expired. Please request a new one.',
            ]);
        }

        return $this->successResponse(null, 'Your password has been reset. You can now sign in.');
    }
}
