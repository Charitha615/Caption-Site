<?php

namespace App\Policies;

use App\Models\Caption;
use App\Models\Project;
use App\Models\User;

class CaptionPolicy
{
    public function view(User $user, Caption $caption): bool
    {
        return $user->id === $caption->project?->user_id;
    }

    public function create(User $user, Project $project): bool
    {
        return $user->id === $project->user_id;
    }

    public function update(User $user, Caption $caption): bool
    {
        return $user->id === $caption->project?->user_id;
    }

    public function delete(User $user, Caption $caption): bool
    {
        return $user->id === $caption->project?->user_id;
    }
}
