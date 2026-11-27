<?php

namespace App\Http\Resources;

use App\Support\UserAgent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * One signed-in device (an API token) as the owner sees it in Settings: browser, system,
 * device type, IP address at sign-in, how they signed in, and when it was last used.
 * The token itself is never included.
 *
 * @mixin PersonalAccessToken
 */
class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $device = UserAgent::parse($this->user_agent);

        return [
            'id' => $this->id,
            'browser' => $device['browser'],
            'os' => $device['os'],
            'device' => $device['device'],
            // Older sign-ins were saved before devices were recorded.
            'known' => $this->user_agent !== null,
            'ip_address' => $this->ip_address,
            'sign_in_method' => $this->sign_in_method,
            'signed_in_at' => $this->created_at?->toISOString(),
            'last_active_at' => ($this->last_used_at ?? $this->created_at)?->toISOString(),
            'current' => $this->id === $request->user()?->currentAccessToken()?->id,
        ];
    }
}
