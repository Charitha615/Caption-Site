<?php

namespace App\Notifications;

use App\Models\AdminMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A message an admin sent, by email (queued: one job per person). */
class AdminMessageMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public AdminMessage $message) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $m = $this->message;
        $brand = (string) config('brand.name');
        $site = rtrim((string) config('brand.website'), '/');
        $mail = (new MailMessage)
            ->subject($m->emoji().' '.$m->title)
            ->greeting('Hello'.($notifiable->name ? " {$notifiable->name}" : '').',');
        foreach (preg_split("/\n\s*\n/", trim($m->body)) ?: [] as $paragraph) {
            $mail->line(trim($paragraph));
        }

        return $mail
            ->action($m->button_label ?: "Open {$brand}", $m->absoluteLink() ?? "{$site}/dashboard")
            ->salutation("— The {$brand} team")
            ->line("You get these emails as a {$brand} user. Turn them off any time in Settings → Notifications ({$site}/settings).");
    }
}
