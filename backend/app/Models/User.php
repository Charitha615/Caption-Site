<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Support\AppLog;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'uuid',
        'name',
        'email',
        'password',
        'avatar_url',
    ];

    /** `plan` and `role` are never mass-assigned from requests (see RegisterUserAction). */
    protected $hidden = [
        'password',
        'remember_token',
        'gemini_api_key',
    ];

    public const AI_KEY_UNVERIFIED = 'unverified';

    public const AI_KEY_VALID = 'valid';

    public const AI_KEY_INVALID = 'invalid';

    protected $attributes = [
        'role' => 'user',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (User $user) {
            if (empty($user->uuid)) {
                $user->uuid = (string) Str::uuid();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            // Encrypted at rest with APP_KEY. Never serialised (see $hidden).
            'gemini_api_key' => 'encrypted',
            'gemini_key_checked_at' => 'datetime',
            'plan_started_at' => 'datetime',
            'plan_expires_at' => 'datetime',
            'plan_reminded_at' => 'datetime',
            'usage_reset_at' => 'datetime',
        ];
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function captionStyles(): HasMany
    {
        return $this->hasMany(CaptionStyle::class);
    }

    public function exports(): HasMany
    {
        return $this->hasMany(Export::class);
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(UsageRecord::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** Length of one usage cycle: limits like "caption minutes per month" reset every this many days. */
    public const USAGE_CYCLE_DAYS = 30;

    /**
     * Start of the current 30-day usage cycle. Cycles count from when the current plan was
     * switched on, or from registration; after a paid plan ends, from its end date.
     */
    public function usageCycleStart(?Carbon $now = null): Carbon
    {
        $now ??= Carbon::now();
        $lapsed = $this->plan && $this->plan !== config('plans.default') && $this->planKey() === config('plans.default');
        $anchor = ($lapsed ? $this->plan_expires_at : ($this->plan_started_at ?? $this->created_at)) ?? $now;
        if ($anchor->greaterThan($now)) {
            return $now->copy();
        }
        $cycleSeconds = self::USAGE_CYCLE_DAYS * 86400;
        $cycles = intdiv((int) $anchor->diffInSeconds($now, true), $cycleSeconds);

        return $anchor->copy()->addSeconds($cycles * $cycleSeconds);
    }

    /** Switches to a plan. A new plan (not a renewal of the current one) starts a new usage cycle. */
    public function switchPlan(string $plan, ?Carbon $expiresAt): void
    {
        $isNewPlan = $plan !== $this->planKey();
        $this->forceFill([
            'plan' => $plan,
            'plan_started_at' => $isNewPlan ? Carbon::now() : ($this->plan_started_at ?? $this->created_at),
            'plan_expires_at' => $expiresAt,
            'plan_reminded_at' => null,
        ])->save();
    }

    /** The plan in force now: a paid plan whose end date has passed counts as the default plan. */
    public function planKey(): string
    {
        $plan = $this->plan ?: config('plans.default');
        if (! array_key_exists($plan, config('plans.plans'))) {
            return config('plans.default');
        }
        if ($plan !== config('plans.default') && $this->plan_expires_at && $this->plan_expires_at->isPast()) {
            return config('plans.default');
        }

        return $plan;
    }

    /**
     * What the current plan includes (see config/plans.php `features`).
     *
     * @return array{max_export_height: int, watermark: bool, premium_styles: bool, editor_ai: bool, priority_support: bool}
     */
    public function planFeatures(): array
    {
        return config('plans.plans.'.$this->planKey().'.features');
    }

    public function hasFeature(string $feature): bool
    {
        return (bool) ($this->planFeatures()[$feature] ?? false);
    }

    /**
     * A key saved under a different APP_KEY (e.g. a database copied from another machine)
     * cannot be decrypted: treat it as "no key" so the user simply adds it again, instead
     * of every request that touches the user failing.
     */
    public function hasAiKey(): bool
    {
        try {
            return ! empty($this->gemini_api_key);
        } catch (DecryptException) {
            AppLog::warning('ai_key.undecryptable', ['user' => $this->id]);

            return false;
        }
    }

    /**
     * Drops a stored key that was encrypted under a different APP_KEY, before the key is
     * replaced or removed: Eloquent decrypts the old value to detect changes, which would
     * otherwise fail ("The MAC is invalid") and block the user from ever saving a new key.
     */
    public function forgetUndecryptableAiKey(): void
    {
        $raw = $this->getAttributes()['gemini_api_key'] ?? null;
        if ($raw === null) {
            return;
        }
        try {
            Crypt::decryptString($raw);
        } catch (DecryptException) {
            AppLog::warning('ai_key.undecryptable_cleared', ['user' => $this->id]);
            // It can never be read again: clear it in the database too, then continue normally.
            static::query()->whereKey($this->getKey())->update(['gemini_api_key' => null]);
            $this->setRawAttributes(['gemini_api_key' => null] + $this->getAttributes(), true);
        }
    }

    /** Public, non-secret description of the user's AI key. */
    public function aiKeyStatus(): array
    {
        return [
            'configured' => $this->hasAiKey(),
            'hint' => $this->hasAiKey() ? $this->gemini_key_hint : null,
            'status' => $this->hasAiKey() ? ($this->gemini_key_status ?: self::AI_KEY_UNVERIFIED) : null,
            'checked_at' => $this->gemini_key_checked_at?->toISOString(),
        ];
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }

    /** "Forgot password" email, with a link to the frontend's reset page. */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }
}
