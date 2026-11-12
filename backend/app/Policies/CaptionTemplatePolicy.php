<?php

namespace App\Policies;

use App\Models\CaptionTemplate;
use App\Models\User;

class CaptionTemplatePolicy
{
    public function view(User $user, CaptionTemplate $template): bool
    {
        return $template->is_system || $template->user_id === $user->id;
    }

    /** System templates are read-only; users manage only their own. */
    public function delete(User $user, CaptionTemplate $template): bool
    {
        return !$template->is_system && $template->user_id === $user->id;
    }
}
