<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_url,
            'whatsapp_number' => $this->whatsapp_number,
            'whatsapp_opt_in' => (bool) $this->whatsapp_opt_in,
            'email_updates' => $this->email_updates === null ? true : (bool) $this->email_updates,
            'role' => $this->role,
            'plan' => $this->planKey(),
            'plan_expires_at' => $this->planKey() !== config('plans.default') ? $this->plan_expires_at?->toISOString() : null,
            'ai_key' => $this->aiKeyStatus(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
