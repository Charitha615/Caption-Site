<?php

namespace App\Services\Billing;

use App\Models\Payment;
use App\Models\User;
use App\Notifications\PaymentReceived;
use App\Notifications\PaymentReviewed;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Pro by bank transfer: a user submits a payment (amount from config/billing.php, a reference
 * code for the transfer remarks, an optional slip); an admin approves it, which puts the user
 * on Pro until the end of the paid period, or rejects it with a reason.
 */
class BillingService
{
    public const SLIP_DISK = 'local';

    public function __construct(protected UsageService $usage) {}

    /**
     * What the payment page needs: prices, bank details, WhatsApp number (and, with a user, their reference).
     *
     * @return array{currency: string, plan: string, prices: array{monthly: int, yearly: int}, bank: array<string, string>, bank_ready: bool, whatsapp: string, whatsapp_link: string, reference: ?string}
     */
    public function details(?User $user = null): array
    {
        $bank = array_map(fn ($v) => (string) $v, config('billing.bank'));

        return [
            'currency' => config('billing.currency'),
            'plan' => config('billing.plan'),
            'prices' => config('billing.prices'),
            'bank' => $bank,
            'bank_ready' => $bank['account_number'] !== '' && $bank['account_name'] !== '',
            'whatsapp' => (string) config('billing.whatsapp'),
            'whatsapp_link' => 'https://wa.me/'.$this->internationalNumber((string) config('billing.whatsapp')),
            'reference' => $user ? Payment::referenceFor($user) : null,
        ];
    }

    /** "075 517 3298" → "94755173298" (Sri Lankan numbers, for wa.me links). */
    public function internationalNumber(string $number): string
    {
        $digits = preg_replace('/\D+/', '', $number) ?? '';

        return str_starts_with($digits, '0') ? '94'.substr($digits, 1) : $digits;
    }

    /** A new payment, waiting for an admin. Only one can be waiting at a time. */
    public function submit(User $user, string $period, ?UploadedFile $slip, ?string $note): Payment
    {
        if ($user->payments()->pending()->exists()) {
            throw ValidationException::withMessages(['period' => 'You already have a payment waiting to be checked. We will confirm it soon.']);
        }

        $payment = new Payment([
            'uuid' => Payment::newUuid(),
            'plan' => config('billing.plan'),
            'period' => $period,
            'amount' => (int) config("billing.prices.{$period}"),
            'currency' => config('billing.currency'),
            'reference' => Payment::referenceFor($user),
            'note' => $note,
        ]);
        $payment->user()->associate($user);
        if ($slip) {
            $payment->forceFill([
                'slip_path' => $slip->store("payments/{$user->uuid}", self::SLIP_DISK),
                'slip_mime' => $slip->getMimeType(),
            ]);
        }
        $payment->save();

        AppLog::info('billing.payment_submitted', ['user' => $user->uuid, 'payment' => $payment->uuid, 'period' => $period, 'slip' => (bool) $slip]);
        Notification::send(User::where('role', 'admin')->get(), new PaymentReceived($payment));

        return $payment;
    }

    /** Adds a slip to a waiting payment (e.g. one first marked "sent on WhatsApp"). */
    public function attachSlip(Payment $payment, UploadedFile $slip): Payment
    {
        $this->ensurePending($payment);
        $old = $payment->slip_path;
        $payment->forceFill([
            'slip_path' => $slip->store("payments/{$payment->user->uuid}", self::SLIP_DISK),
            'slip_mime' => $slip->getMimeType(),
        ])->save();
        if ($old) {
            Storage::disk(self::SLIP_DISK)->delete($old);
        }

        return $payment;
    }

    /**
     * Turns Pro on for the paid period. Paying before the current Pro ends adds the time on
     * after it, so nothing already paid for is lost.
     */
    public function approve(Payment $payment, User $admin, ?string $adminNote = null): Payment
    {
        $this->ensurePending($payment);

        DB::transaction(function () use ($payment, $admin, $adminNote) {
            $user = $payment->user()->lockForUpdate()->first();
            $start = $user->planKey() === $payment->plan && $user->plan_expires_at?->isFuture()
                ? $user->plan_expires_at->copy()
                : Carbon::now();
            $end = $payment->period === 'yearly' ? $start->copy()->addYear() : $start->copy()->addDays(User::USAGE_CYCLE_DAYS);

            $user->switchPlan($payment->plan, $end);
            $payment->forceFill([
                'status' => Payment::STATUS_APPROVED,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'admin_note' => $adminNote,
                'period_start' => $start,
                'period_end' => $end,
            ])->save();
        });

        $this->usage->forget($payment->user_id);
        AppLog::info('billing.payment_approved', ['payment' => $payment->uuid, 'admin' => $admin->uuid, 'until' => $payment->period_end?->toDateString()]);
        $payment->user->notify(new PaymentReviewed($payment));

        return $payment->refresh();
    }

    public function reject(Payment $payment, User $admin, string $reason): Payment
    {
        $this->ensurePending($payment);
        $payment->forceFill([
            'status' => Payment::STATUS_REJECTED,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'admin_note' => $reason,
        ])->save();

        AppLog::info('billing.payment_rejected', ['payment' => $payment->uuid, 'admin' => $admin->uuid]);
        $payment->user->notify(new PaymentReviewed($payment));

        return $payment;
    }

    protected function ensurePending(Payment $payment): void
    {
        if ($payment->status !== Payment::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => 'This payment has already been '.$payment->status.'.']);
        }
    }
}
