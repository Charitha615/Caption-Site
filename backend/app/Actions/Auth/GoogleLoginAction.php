<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Services\Auth\GoogleTokenVerifier;
use App\Support\AppLog;
use App\Support\SignupAttribution;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * "Continue with Google": signs in the matching account, links Google to an existing
 * account with the same (Google-verified) email, or creates a new account.
 */
class GoogleLoginAction
{
    public function __construct(protected GoogleTokenVerifier $verifier, protected IssueAccessToken $issueToken) {}

    /**
     * @param  array<string, ?string>|null  $attribution  where a new account came from (ignored for existing accounts)
     * @return array{user: User, token: string, created: bool}
     */
    public function execute(string $accessToken, ?array $attribution = null): array
    {
        $google = $this->verifier->verify($accessToken);

        $user = User::where('google_id', $google['sub'])->first()
            ?? User::where('email', $google['email'])->first();
        $created = false;

        if (! $user) {
            $user = User::create([
                'uuid' => (string) Str::uuid(),
                'name' => mb_substr($google['name'], 0, 255),
                'email' => $google['email'],
                // Google-only accounts get an unguessable password; they sign in with Google.
                'password' => Hash::make(Str::random(64)),
                'avatar_url' => $google['picture'],
            ]);
            $user->forceFill(['plan' => config('plans.default'), ...SignupAttribution::toColumns($attribution)])->save();
            $created = true;
        }

        $user->forceFill([
            'google_id' => $google['sub'],
            'email_verified_at' => $user->email_verified_at ?? now(),
            'avatar_url' => $user->avatar_url ?: $google['picture'],
        ])->save();

        AppLog::info($created ? 'auth.google_registered' : 'auth.google_login', ['user' => $user->uuid, 'ip' => request()->ip()]);

        return ['user' => $user, 'token' => $this->issueToken->execute($user, 'google'), 'created' => $created];
    }
}
