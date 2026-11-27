<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** To the user: their Pro payment was approved (Pro is on until …) or could not be confirmed. */
class PaymentReviewed extends Notification
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
        $billing = rtrim((string) config('brand.website'), '/').'/billing';
        $mail = (new MailMessage)->greeting('Hello'.($notifiable->name ? " {$notifiable->name}" : '').',')->salutation("— The {$brand} team");

        if ($p->status === Payment::STATUS_APPROVED) {
            return $mail
                ->subject("{$brand} Pro is on — thank you!")
                ->line("We received your payment of {$p->currency} ".number_format($p->amount)." ({$p->reference}).")
                ->line('Pro is now active until '.$p->period_end?->format('j F Y').'.')
                ->action('Start creating', rtrim((string) config('brand.website'), '/').'/dashboard');
        }

        return $mail
            ->subject("We couldn't confirm your {$brand} payment")
            ->line("We couldn't match your payment {$p->reference} with a transfer in our bank account.")
            ->when($p->admin_note, fn (MailMessage $m) => $m->line('Reason: '.$p->admin_note))
            ->line('If you did pay, reply on WhatsApp ('.config('billing.whatsapp').') with your slip and we will sort it out.')
            ->action('Try again', $billing);
    }
}
