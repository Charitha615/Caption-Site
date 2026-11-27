<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * The "reset your password" email. The button opens the frontend's /reset-password page,
 * which sends the token back to POST /api/auth/reset-password.
 */
class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $brand = (string) config('brand.name', config('app.name'));
        $minutes = (int) config('auth.passwords.users.expire', 60);

        return (new MailMessage)
            ->subject("Reset your {$brand} password")
            ->greeting('Hello'.($notifiable->name ? " {$notifiable->name}" : '').',')
            ->line("We received a request to reset the password for your {$brand} account.")
            ->action('Reset password', $this->resetUrl($notifiable))
            ->line("This link expires in {$minutes} minutes and can only be used once.")
            ->line('If you did not ask for this, you can ignore this email. Your password will not change.')
            ->salutation("— The {$brand} team");
    }

    protected function resetUrl($notifiable): string
    {
        $base = rtrim((string) config('brand.website'), '/');

        return $base.'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}
