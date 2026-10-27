<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CaptionStyle extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'user_id',
        'project_id',
        'name',
        'is_default',
        'font_family',
        'font_size',
        'primary_color',
        'outline_color',
        'background_color',
        'position',
        'alignment',
        'animation_effect',
        'style_data',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'font_size' => 'integer',
        'style_data' => 'array',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (CaptionStyle $style) {
            if (empty($style->uuid)) {
                $style->uuid = (string) Str::uuid();
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
