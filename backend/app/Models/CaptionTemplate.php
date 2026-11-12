<?php

namespace App\Models;

use App\Services\Caption\CaptionStyleNormalizer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CaptionTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'user_id',
        'slug',
        'name',
        'description',
        'category',
        'is_system',
        'style',
        'preview_text',
        'sort_order',
    ];

    protected $hidden = ['id', 'user_id'];

    protected $casts = [
        'is_system' => 'boolean',
        'style' => 'array',
        'sort_order' => 'integer',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (CaptionTemplate $template) {
            if (empty($template->uuid)) {
                $template->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** System templates plus the given user's own templates. */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where(fn (Builder $q) => $q->where('is_system', true)->orWhere('user_id', $userId));
    }

    /**
     * Create/update system templates from resources/captions/presets.json — the same
     * structured configuration the editor bundles. Idempotent; safe on every deploy.
     */
    public static function syncSystemTemplates(): int
    {
        $path = config('captions.presets_path');
        $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
        $normalizer = app(CaptionStyleNormalizer::class);

        foreach ($data['presets'] as $i => $preset) {
            static::withTrashed()->updateOrCreate(
                ['slug' => $preset['key'], 'user_id' => null],
                [
                    'name' => $preset['label'],
                    'description' => $preset['description'] ?? null,
                    'category' => 'preset',
                    'is_system' => true,
                    'style' => $normalizer->normalize(['preset' => $preset['key']] + $preset['style']),
                    'preview_text' => $preset['sample'] ?? null,
                    'sort_order' => $i,
                    'deleted_at' => null,
                ],
            );
        }

        return count($data['presets']);
    }
}
