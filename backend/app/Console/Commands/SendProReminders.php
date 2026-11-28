<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\ProEndingSoon;
use App\Services\Billing\TrialService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('billing:pro-reminders')]
#[Description('Emails users whose Pro ends within config(billing.reminder_days) days (once per paid period)')]
class SendProReminders extends Command
{
    public function handle(TrialService $trials): int
    {
        $sent = 0;
        User::query()
            ->where('plan', '!=', config('plans.default'))
            ->whereNotNull('plan_expires_at')
            ->whereBetween('plan_expires_at', [now(), now()->addDays((int) config('billing.reminder_days'))])
            // Cleared when a payment is approved, so each paid period gets one reminder.
            ->whereNull('plan_reminded_at')
            ->each(function (User $user) use (&$sent, $trials) {
                // A trial is only a few days long: remind the day before it ends, not right after it starts.
                if ($trials->isOnTrial($user) && $user->plan_expires_at->greaterThan(now()->addDay())) {
                    return;
                }
                $user->notify(new ProEndingSoon($user->plan_expires_at));
                $user->forceFill(['plan_reminded_at' => now()])->save();
                $sent++;
            });

        $this->info("Sent {$sent} Pro reminder(s).");

        return self::SUCCESS;
    }
}
