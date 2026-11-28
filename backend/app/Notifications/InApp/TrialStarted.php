<?php

namespace App\Notifications\InApp;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** To the user: their free Pro trial is on. */
class TrialStarted extends Notification
{
    use InAppMessage;

    public function __construct(public Carbon $endsAt, public int $days) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: string, link: ?string} */
    public function toArray(object $notifiable): array
    {
        return $this->inApp('plan', "Your {$this->days}-day Pro trial is on 🎉", 'Everything in Pro until '.$this->endsAt->format('j F').': 600 caption minutes, 4K with no watermark, all styles and the AI tools. Keep Pro any time from the Pro plan page.', '/billing');
    }
}
