<?php

namespace App\Notifications\InApp;

use App\Models\AdminMessage as AdminMessageModel;
use Illuminate\Notifications\Notification;

/** A message an admin sent, in the app's notification bell. */
class AdminMessage extends Notification
{
    use InAppMessage;

    public function __construct(public AdminMessageModel $message) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: string, link: ?string, category: string, button_label: ?string, message_id: int} */
    public function toArray(object $notifiable): array
    {
        return $this->inApp('admin', $this->message->title, $this->message->body, $this->message->link) + [
            'category' => $this->message->category,
            'button_label' => $this->message->button_label,
            'message_id' => $this->message->id,
        ];
    }
}
