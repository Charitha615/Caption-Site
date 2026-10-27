<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterUserAction
{
    /**
     * Create a new user and generate a Sanctum personal access token.
     *
     * @param array{name: string, email: string, password: string} $data
     * @return array{user: User, token: string}
     */
    public function execute(array $data): array
    {
        $user = User::create([
            'uuid' => (string) Str::uuid(),
            'name' => $data['name'],
            'email' => strtolower(trim($data['email'])),
            'password' => Hash::make($data['password']),
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
