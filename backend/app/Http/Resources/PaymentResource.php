<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A Pro payment. The slip is never exposed as a path: `has_slip` tells the app to fetch it
 * from the slip endpoint. `user` is included for admins only (see `forAdmin`).
 *
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    public bool $forAdmin = false;

    public function forAdmin(): static
    {
        $this->forAdmin = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'plan' => $this->plan,
            'period' => $this->period,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'reference' => $this->reference,
            'status' => $this->status,
            'has_slip' => $this->slip_path !== null,
            'note' => $this->note,
            'admin_note' => $this->admin_note,
            'created_at' => $this->created_at?->toISOString(),
            'reviewed_at' => $this->reviewed_at?->toISOString(),
            'period_start' => $this->period_start?->toISOString(),
            'period_end' => $this->period_end?->toISOString(),
            $this->mergeWhen($this->forAdmin, fn () => [
                'user' => [
                    'uuid' => $this->user?->uuid,
                    'name' => $this->user?->name,
                    'email' => $this->user?->email,
                    'plan' => $this->user?->planKey(),
                    'plan_expires_at' => $this->user?->plan_expires_at?->toISOString(),
                ],
            ]),
        ];
    }
}
