<?php

namespace App\Actions\Auth;

use App\Models\Setting;
use App\Models\User;
use App\Notifications\InApp\Welcome;

/** First steps for a new account: a welcome notification, and the app tour on first visit. */
class WelcomeNewUser
{
    public function execute(User $user): void
    {
        Setting::updateOrCreate(['user_id' => $user->id, 'key' => 'tour_pending'], ['value' => ['v' => true]]);
        $user->notify(new Welcome);
    }
}
