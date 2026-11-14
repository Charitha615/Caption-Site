<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Str;

class CreateProjectAction
{
    /**
     * Create a new video captioning project.
     */
    public function execute(User $user, array $data): Project
    {
        $project = Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'status' => Project::STATUS_DRAFT,
            'language' => $data['language'] ?? config('brand.locale.default_language', 'si'),
            'duration' => 0.0,
            'settings' => $data['settings'] ?? [
                'caption_style' => 'default',
                'auto_capitalize' => true,
                'max_chars_per_line' => 38,
            ],
        ]);

        return $project;
    }
}
