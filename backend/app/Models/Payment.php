<?php

namespace App\Models;

use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A Pro payment by bank transfer: pending until an admin approves (Pro is switched on
 * for the period) or rejects it. The slip, when uploaded, is a private file.
 */
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED];

    public const PERIODS = ['monthly', 'yearly'];

    protected $attributes = ['status' => self::STATUS_PENDING];

    /** Never mass-assigned: status, review fields and the Pro period are set by the approval flow only. */
    protected $fillable = ['uuid', 'plan', 'period', 'amount', 'currency', 'reference', 'note'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'reviewed_at' => 'datetime',
            'period_start' => 'datetime',
            'period_end' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** @param  Builder<Payment>  $query */
    public function scopePending(Builder $query): void
    {
        $query->where('status', self::STATUS_PENDING);
    }

    /**
     * The user's payment reference for the transfer remarks, e.g. "SS-7KQ2PX": the same every time,
     * so it can be shown before they pay. Letters and digits that are easy to read (no 0/O, 1/I).
     */
    public static function referenceFor(User $user): string
    {
        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        $hash = hash('sha256', 'payment-ref|'.$user->uuid, true);

        return 'SS-'.implode('', array_map(fn (int $i) => $alphabet[ord($hash[$i]) % 32], range(0, 5)));
    }

    public static function newUuid(): string
    {
        return (string) Str::uuid();
    }
}
