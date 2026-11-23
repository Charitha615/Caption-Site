<?php

namespace App\Models;

use App\Support\AppLog;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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

    public function planKey(): string
    {
        $plan = $this->plan ?: config('plans.default');

        return array_key_exists($plan, config('plans.plans')) ? $plan : config('plans.default');
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
}
