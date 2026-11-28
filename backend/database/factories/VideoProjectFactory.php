<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\VideoProject;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VideoProject>
 */
class VideoProjectFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'name' => fake()->words(3, true),
            'aspect' => '9:16',
            'duration' => 12.5,
            'clip_count' => 2,
            'data' => json_encode(['version' => 1, 'tracks' => [], 'clips' => [], 'media' => [], 'fonts' => []]),
        ];
    }
}
