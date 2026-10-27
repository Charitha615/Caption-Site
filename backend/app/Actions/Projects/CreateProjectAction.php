<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Str;

class CreateProjectAction
{
    /**
     * Create a new video captioning project.
     *
     * @param User $user
     * @param array $data
     * @return Project
     */
    public function execute(User $user, array $data): Project
    {
        $project = Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'language' => $data['language'] ?? 'si',
            'duration' => $data['duration'] ?? 0.0,
            'width' => $data['width'] ?? 1920,
            'height' => $data['height'] ?? 1080,
            'fps' => $data['fps'] ?? 30.0,
            'thumbnail' => $data['thumbnail'] ?? null,
            'settings' => $data['settings'] ?? [
                'caption_style' => 'default',
                'auto_capitalize' => true,
                'max_chars_per_line' => 38,
            ],
        ]);

        return $project;
    }
}
