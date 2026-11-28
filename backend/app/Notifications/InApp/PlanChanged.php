<?php

namespace App\Notifications\InApp;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** To the user: an admin changed their plan. */
class PlanChanged extends Notification
{
    use InAppMessage;

    public function __construct(public string $planLabel, public ?Carbon $until) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: string, link: ?string} */
    public function toArray(object $notifiable): array
    {
        $until = $this->until ? ' until '.$this->until->format('j F Y') : '';

        return $this->inApp('plan', "You're now on {$this->planLabel}", "Your account was switched to the {$this->planLabel} plan{$until}.", '/billing');
    }
}
