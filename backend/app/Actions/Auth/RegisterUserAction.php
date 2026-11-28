<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\PhoneNumber;
use App\Support\SignupAttribution;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class RegisterUserAction
{
    public function __construct(protected IssueAccessToken $issueToken) {}

    /**
     * Create a new user and generate a Sanctum personal access token.
     *
     * @param  array{name: string, email: string, password: string, attribution?: ?array<string, ?string>}  $data
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
        $whatsApp = PhoneNumber::normalize($data['whatsapp_number'] ?? null);
        $user->forceFill([
            'plan' => config('plans.default'),
            'whatsapp_number' => $whatsApp,
            'whatsapp_opt_in' => $whatsApp !== null && ! empty($data['whatsapp_opt_in']),
            ...SignupAttribution::toColumns($data['attribution'] ?? null),
        ])->save();
        app(WelcomeNewUser::class)->execute($user);

        $token = $this->issueToken->execute($user, 'register');

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
