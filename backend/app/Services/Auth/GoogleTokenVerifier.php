<?php

namespace App\Services\Auth;

use App\Support\AppLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Checks a Google OAuth access token from "Continue with Google" with Google itself:
 * the token must have been issued to OUR client id (so a token from another app can't be
 * replayed here) and the Google account's email must be verified.
 */
class GoogleTokenVerifier
{
    public const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

    public const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

    public function isConfigured(): bool
    {
        return filled(config('services.google.client_id'));
    }

    /**
     * @return array{sub: string, email: string, name: string, picture: ?string}
     *
     * @throws ValidationException
     */
    public function verify(string $accessToken): array
    {
        $clientId = (string) config('services.google.client_id');

        $info = Http::acceptJson()->timeout(10)->get(self::TOKENINFO_URL, ['access_token' => $accessToken]);
        $audience = (string) ($info->json('aud') ?? $info->json('azp') ?? '');
        if (! $info->successful() || ! hash_equals($clientId, $audience)) {
            AppLog::warning('auth.google_rejected', ['reason' => $info->successful() ? 'audience' : 'invalid_token', 'status' => $info->status()]);
            $this->fail();
        }

        $profile = Http::acceptJson()->timeout(10)->withToken($accessToken)->get(self::USERINFO_URL);
        $email = strtolower(trim((string) $profile->json('email')));
        if (! $profile->successful() || $email === '' || ! filter_var($profile->json('email_verified'), FILTER_VALIDATE_BOOLEAN) || blank($profile->json('sub'))) {
            AppLog::warning('auth.google_rejected', ['reason' => 'profile', 'status' => $profile->status()]);
            $this->fail('Your Google account has no verified email address.');
        }

        return [
            'sub' => (string) $profile->json('sub'),
            'email' => $email,
            'name' => trim((string) ($profile->json('name') ?: strstr($email, '@', true))),
            'picture' => $profile->json('picture') ?: null,
        ];
    }

    private function fail(string $message = 'Google sign-in failed. Please try again.'): never
    {
        throw ValidationException::withMessages(['access_token' => [$message]]);
    }
}
