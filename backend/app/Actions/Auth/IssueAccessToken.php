<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\UserAgent;

/**
 * Signs a user in on one device: creates their API token and records where it came from
 * (browser, IP address, sign-in method) for the "Signed-in devices" list in Settings.
 */
class IssueAccessToken
{
    /**
     * Reads the current request when called (not when built): controllers and their
     * dependencies can outlive one request, so a request captured earlier may be stale.
     *
     * @param  'password'|'google'|'register'  $method
     * @return string the plain-text token for the client
     */
    public function execute(User $user, string $method, ?string $deviceName = null): string
    {
        $request = request();
        $userAgent = mb_substr((string) $request->userAgent(), 0, 512) ?: null;
        $name = $deviceName && $deviceName !== 'web-app' ? $deviceName : UserAgent::describe($userAgent);

        $token = $user->createToken(mb_substr($name, 0, 255));
        $token->accessToken->forceFill([
            'ip_address' => $request->ip(),
            'user_agent' => $userAgent,
            'sign_in_method' => $method,
        ])->save();

        return $token->plainTextToken;
    }
}
