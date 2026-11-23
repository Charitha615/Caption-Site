<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public shape of a review: the reviewer's display name and avatar only — never their email.
 * `status` is included only for the author and admins (see `withStatus`).
 */
class ReviewResource extends JsonResource
{
    public bool $withStatus = false;

    public function withStatus(): static
    {
        $this->withStatus = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'rating' => $this->rating,
            'body' => $this->body,
            'role' => $this->role,
            'name' => $this->user?->name,
            'avatar_url' => $this->user?->avatar_url,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            $this->mergeWhen($this->withStatus, fn () => [
                'status' => $this->status,
                'approved_at' => $this->approved_at?->toISOString(),
            ]),
        ];
    }
}
