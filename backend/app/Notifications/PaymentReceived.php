<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To admins: a Pro payment is waiting to be checked against the bank. */
class PaymentReceived extends Notification
{
    use Queueable;

    public function __construct(public Payment $payment) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $p = $this->payment;
        $brand = (string) config('brand.name');

        return (new MailMessage)
            ->subject("New Pro payment: {$p->currency} ".number_format($p->amount)." ({$p->reference})")
            ->greeting('New payment to check')
            ->line("{$p->user->name} ({$p->user->email}) paid for Pro ".($p->period === 'yearly' ? 'yearly' : 'monthly').": {$p->currency} ".number_format($p->amount).'.')
            ->line("Reference: {$p->reference}. ".($p->slip_path ? 'A slip was uploaded.' : 'No slip uploaded; it may come on WhatsApp.'))
            ->action('Review payments', rtrim((string) config('brand.website'), '/').'/admin/payments')
            ->salutation("— {$brand}");
    }
}
