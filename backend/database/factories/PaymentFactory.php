<?php

namespace Database\Factories;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'plan' => 'pro',
            'period' => 'monthly',
            'amount' => 490,
            'currency' => 'LKR',
            'reference' => 'SS-'.strtoupper(Str::random(6)),
            'status' => Payment::STATUS_PENDING,
        ];
    }

    public function yearly(): static
    {
        return $this->state(fn () => ['period' => 'yearly', 'amount' => 3990]);
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => Payment::STATUS_APPROVED, 'reviewed_at' => now()]);
    }
}
