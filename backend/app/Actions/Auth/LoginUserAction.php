<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUserAction
{
    /**
     * Authenticate user credentials and create token.
     *
     * @param array{email: string, password: string, device_name?: string} $credentials
     * @return array{user: User, token: string}
     * @throws ValidationException
     */
    public function execute(array $credentials): array
    {
        $user = User::where('email', strtolower(trim($credentials['email'])))->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => [__('The provided credentials do not match our records.')],
            ]);
        }

        $deviceName = $credentials['device_name'] ?? 'web-app';
        $token = $user->createToken($deviceName)->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
