<?php

namespace App\Notifications\InApp;

use Illuminate\Notifications\Notification;

/** To a new user: hello, and where to start. */
class Welcome extends Notification
{
    use InAppMessage;

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: string, link: ?string} */
    public function toArray(object $notifiable): array
    {
        $brand = (string) config('brand.title_name');

        return $this->inApp('welcome', "Welcome to {$brand}! 👋", 'Upload a video and get සිංහල or English captions in minutes. Your first 15 caption minutes this month are free.', '/projects/create');
    }
}
