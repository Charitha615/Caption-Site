<?php

namespace App\Jobs;

use App\Models\AdminMessage;
use App\Notifications\AdminMessageMail;
use App\Notifications\InApp\AdminMessage as AdminMessageNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Notification;

/**
 * Delivers an admin's message to its audience in batches: to the notification bell straight away,
 * and as one queued email per person. (WhatsApp is sent by the admin from a click-to-send list.)
 */
class SendAdminMessage implements ShouldQueue
{
    use Queueable;

    public int $timeout = 600;

    public function __construct(public AdminMessage $message) {}

    public function handle(): void
    {
        $counts = [];
        if ($this->message->sendsOn('in_app')) {
            $counts['recipients'] = 0;
            $this->message->recipients()->chunkById(500, function ($users) use (&$counts) {
                Notification::sendNow($users, new AdminMessageNotification($this->message));
                $counts['recipients'] += $users->count();
            });
        }
        if ($this->message->sendsOn('email')) {
            $counts['email_recipients'] = 0;
            $this->message->recipients('email')->chunkById(500, function ($users) use (&$counts) {
                Notification::send($users, new AdminMessageMail($this->message));
                $counts['email_recipients'] += $users->count();
            });
        }
        $this->message->update($counts);
    }
}
