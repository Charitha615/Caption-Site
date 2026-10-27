<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        return [
            'uuid' => (string) Str::uuid(),
            'user_id' => User::factory(),
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'status' => 'draft',
            'duration' => 60.0,
            'width' => 1920,
            'height' => 1080,
            'fps' => 30.0,
            'language' => 'si',
            'thumbnail' => null,
            'settings' => [
                'caption_style' => 'default',
            ],
        ];
    }
}
