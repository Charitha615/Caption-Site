<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\AppLog;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    public function __construct(protected IssueAccessToken $issueToken) {}

    /**
     * Authenticate user credentials and create token.
     *
     * @param  array{email: string, password: string, device_name?: string}  $credentials
     * @return array{user: User, token: string}
     *
     * @throws ValidationException
     */
    public function execute(array $credentials): array
    {
        $user = User::where('email', strtolower(trim($credentials['email'])))->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            // Hash the address so failed-login logs don't collect personal data.
            AppLog::warning('auth.login_failed', ['email_hash' => hash('sha256', strtolower(trim($credentials['email']))), 'ip' => request()->ip()]);

            throw ValidationException::withMessages([
                'email' => [__('The provided credentials do not match our records.')],
            ]);
        }

        AppLog::info('auth.login', ['user' => $user->uuid, 'ip' => request()->ip()]);
        $token = $this->issueToken->execute($user, 'password', $credentials['device_name'] ?? null);

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
