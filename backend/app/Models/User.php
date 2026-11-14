<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
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
    ];

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

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function settings(): HasMany
    {
        return $this->hasMany(Setting::class);
    }
}
