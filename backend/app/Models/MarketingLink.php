<?php

namespace App\Models;

use Database\Factories\MarketingLinkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A campaign link the admin made for one post, ad or creator, e.g. "/?utm_source=facebook&utm_medium=post&utm_campaign=text-captions".
 * Sign-ups that arrived through it are the users with the same source / medium / campaign.
 */
class MarketingLink extends Model
{
    /** @use HasFactory<MarketingLinkFactory> */
    use HasFactory;

    protected $fillable = ['name', 'source', 'medium', 'campaign', 'path', 'notes'];

    protected static function booted(): void
    {
        static::creating(function (MarketingLink $link) {
            $link->uuid ??= (string) Str::uuid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Users who signed up through this link.
     *
     * @return Builder<User>
     */
    public function signups(): Builder
    {
        return User::query()
            ->where('signup_source', $this->source)
            ->where(fn ($q) => $this->medium === null ? $q->whereNull('signup_medium') : $q->where('signup_medium', $this->medium))
            ->where(fn ($q) => $this->campaign === null ? $q->whereNull('signup_campaign') : $q->where('signup_campaign', $this->campaign));
    }

    /** A UTM value as stored on users: lower case, words joined by "-", only URL-safe characters. */
    public static function tag(?string $value): ?string
    {
        $value = trim(preg_replace('/[^a-z0-9._-]+/', '-', mb_strtolower(trim((string) $value))), '-');

        return $value === '' ? null : mb_substr($value, 0, 100);
    }
}
