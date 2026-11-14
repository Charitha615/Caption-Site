<?php

namespace App\Policies;

use App\Models\UploadSession;
use App\Models\User;

class UploadSessionPolicy
{
    public function view(User $user, UploadSession $upload): bool
    {
        return $user->id === $upload->user_id;
    }

    public function update(User $user, UploadSession $upload): bool
    {
        return $user->id === $upload->user_id && $upload->project?->user_id === $user->id;
    }

    public function delete(User $user, UploadSession $upload): bool
    {
        return $user->id === $upload->user_id;
    }
}
