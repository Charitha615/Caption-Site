<?php

namespace Database\Factories;

use App\Models\Review;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Review>
 */
class ReviewFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'rating' => fake()->numberBetween(4, 5),
            'body' => fake()->sentence(16),
            'role' => fake()->randomElement(['Travel vlogger', 'Car reviewer', 'Educator', 'Video editor']),
            'status' => Review::STATUS_PENDING,
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => ['status' => Review::STATUS_APPROVED, 'approved_at' => now()]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => Review::STATUS_REJECTED]);
    }
}
