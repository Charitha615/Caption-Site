<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** To the user: Pro ends in a few days; renew by bank transfer to keep it. */
class ProEndingSoon extends Notification
{
    use Queueable;

    public function __construct(public Carbon $endsAt) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $brand = (string) config('brand.name');

        return (new MailMessage)
            ->subject("Your {$brand} Pro ends on ".$this->endsAt->format('j F'))
            ->greeting('Hello'.($notifiable->name ? " {$notifiable->name}" : '').',')
            ->line('Your Pro plan ends on '.$this->endsAt->format('j F Y').'. After that your account moves to the Free plan; your projects stay safe.')
            ->line('Renew now and the new time is added after your current end date, so you lose nothing.')
            ->action('Renew Pro', rtrim((string) config('brand.website'), '/').'/billing')
            ->salutation("— The {$brand} team");
    }
}
