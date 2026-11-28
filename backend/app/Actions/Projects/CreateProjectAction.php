<?php

namespace App\Actions\Projects;

use App\Models\CaptionTemplate;
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
        $settings = $data['settings'] ?? [
            'caption_style' => 'default',
            'auto_capitalize' => true,
            'max_chars_per_line' => 38,
        ];
        if (! $user->hasFeature('premium_styles') && empty($settings['editor']['style'])) {
            // Free plan: start with a style it can export (the default, Spotlight, is a Pro style).
            $style = CaptionTemplate::presetStyle((string) config('plans.free_default_preset'));
            if ($style) {
                $settings['editor'] = array_merge(['version' => 2], $settings['editor'] ?? [], ['style' => $style]);
            }
        }

        $project = Project::create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'script' => filled($data['script'] ?? null) ? trim($data['script']) : null,
            'vocabulary' => filled($data['vocabulary'] ?? null) ? trim($data['vocabulary']) : null,
            'status' => Project::STATUS_DRAFT,
            'language' => $data['language'] ?? 'auto',
            'duration' => 0.0,
            'settings' => $settings,
        ]);

        return $project;
    }
}
