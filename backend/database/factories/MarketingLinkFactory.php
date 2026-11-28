<?php

namespace Database\Factories;

use App\Models\MarketingLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MarketingLink>
 */
class MarketingLinkFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'source' => fake()->randomElement(['facebook', 'tiktok', 'youtube', 'instagram']),
            'medium' => fake()->randomElement(['post', 'ad', 'story', 'bio']),
            'campaign' => fake()->unique()->slug(2),
            'path' => '/',
            'notes' => null,
        ];
    }
}
