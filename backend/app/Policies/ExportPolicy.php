<?php

namespace App\Policies;

use App\Models\Export;
use App\Models\User;

class ExportPolicy
{
    public function view(User $user, Export $export): bool
    {
        return $export->project && $user->id === $export->project->user_id;
    }

    public function delete(User $user, Export $export): bool
    {
        return $this->view($user, $export);
    }
}
