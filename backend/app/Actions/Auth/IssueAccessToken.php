<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\UserAgent;

/**
 * Signs a user in on one device: creates their API token and records where it came from
 * (browser, IP address, sign-in method) for the "Signed-in devices" list in Settings.
 *
 * Signing in again on the same device replaces that device's previous session, so the list (and
 * the table) keeps one row per device with the latest sign-in time.
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
        $deviceId = self::deviceId($request->input('device_id'));

        $this->forgetPreviousSession($user, $deviceId, $userAgent, $request->ip());

        $token = $user->createToken(mb_substr($name, 0, 255));
        $token->accessToken->forceFill([
            'ip_address' => $request->ip(),
            'user_agent' => $userAgent,
            'sign_in_method' => $method,
            'device_id' => $deviceId,
        ])->save();

        return $token->plainTextToken;
    }

    /** The browser's own id ("device_id" in the sign-in request), when it looks like one. */
    public static function deviceId(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^[A-Za-z0-9_-]{16,64}$/', $value) ? $value : null;
    }

    /**
     * Removes the session this device had before. Without a device id (older apps, and sessions
     * from before device ids), the same browser on the same IP address counts as the same device.
     */
    private function forgetPreviousSession(User $user, ?string $deviceId, ?string $userAgent, ?string $ip): void
    {
        $user->tokens()->where(function ($query) use ($deviceId, $userAgent, $ip) {
            if ($deviceId !== null) {
                $query->where('device_id', $deviceId);
            }
            if ($userAgent !== null && $ip !== null) {
                $query->orWhere(fn ($q) => $q->whereNull('device_id')->where('user_agent', $userAgent)->where('ip_address', $ip));
            } elseif ($deviceId === null) {
                $query->whereRaw('1 = 0');
            }
        })->delete();
    }
}
