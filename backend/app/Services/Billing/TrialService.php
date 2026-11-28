<?php

namespace App\Services\Billing;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\InApp\TrialStarted;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The free Pro trial: `plans.trial.days` days of Pro, once per email, for accounts on Free that
 * have never paid. Paying during the trial adds the paid time after it (see BillingService::approve).
 */
class TrialService
{
    public function __construct(protected UsageService $usage) {}

    /**
     * The same mailbox, however it is written: lower case, and for Gmail without dots or a +tag
     * (n.i.mal+trial@gmail.com and nimal@googlemail.com are the same person).
     */
    public static function normalizeEmail(string $email): string
    {
        $email = mb_strtolower(trim($email));
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if (in_array($domain, ['gmail.com', 'googlemail.com'], true)) {
            $local = str_replace('.', '', explode('+', $local, 2)[0]);
            $domain = 'gmail.com';
        }

        return "{$local}@{$domain}";
    }

    public static function emailHash(string $email): string
    {
        return hash('sha256', self::normalizeEmail($email));
    }

    public function days(): int
    {
        return max(1, (int) config('plans.trial.days', 7));
    }

    /** Why the account can't start a trial, or null when it can. */
    public function ineligibleReason(User $user): ?string
    {
        if ($user->trial_started_at !== null) {
            return 'You have already used your free trial.';
        }
        if ($user->planKey() !== config('plans.default')) {
            return 'You already have '.config('plans.plans.'.$user->planKey().'.label').'.';
        }
        if ($user->payments()->where('status', Payment::STATUS_APPROVED)->exists()) {
            return 'The free trial is for people new to Pro.';
        }
        if (DB::table('trial_claims')->where('email_hash', self::emailHash($user->email))->exists()) {
            return 'A free trial was already used with this email address.';
        }

        return null;
    }

    public function isEligible(User $user): bool
    {
        return $this->ineligibleReason($user) === null;
    }

    /** Whether the account is on its trial now (not on time it paid for). */
    public function isOnTrial(User $user): bool
    {
        return $user->trial_started_at !== null
            && $user->planKey() === config('plans.trial.plan')
            && $user->plan_expires_at !== null
            && $user->plan_expires_at->lessThanOrEqualTo($this->trialEnd($user)->addMinute());
    }

    public function trialEnd(User $user): Carbon
    {
        return $user->trial_started_at->copy()->addDays($this->days());
    }

    /** Starts the trial. Throws a validation error when the account can't have one. */
    public function start(User $user): Carbon
    {
        if ($reason = $this->ineligibleReason($user)) {
            throw ValidationException::withMessages(['trial' => $reason]);
        }
        $now = Carbon::now();
        $ends = $now->copy()->addDays($this->days());
        try {
            DB::transaction(function () use ($user, $now, $ends) {
                // The unique hash is the real once-per-email guard (two clicks at once included).
                DB::table('trial_claims')->insert(['email_hash' => self::emailHash($user->email), 'user_id' => $user->id, 'created_at' => $now]);
                $user->switchPlan((string) config('plans.trial.plan'), $ends);
                $user->forceFill(['trial_started_at' => $now])->save();
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['trial' => 'A free trial was already used with this email address.']);
        }
        $this->usage->forget($user->id);
        AppLog::info('billing.trial_started', ['user' => $user->uuid, 'until' => $ends->toDateString()]);
        $user->notify(new TrialStarted($ends, $this->days()));

        return $ends;
    }
}
