<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Caption extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'project_id',
        'transcript_id',
        'sequence',
        'start_time',
        'end_time',
        'text',
        'language',
        'style_id',
        'style_override',
        'metadata',
    ];

    protected $casts = [
        'sequence' => 'integer',
        'start_time' => 'float',
        'end_time' => 'float',
        'style_override' => 'array',
        'metadata' => 'array',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Caption $caption) {
            if (empty($caption->uuid)) {
                $caption->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function resolveRouteBinding($value, $field = null)
    {
        return $this->where('uuid', $value)
            ->orWhere('id', $value)
            ->first();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function transcript(): BelongsTo
    {
        return $this->belongsTo(Transcript::class);
    }

    public function style(): BelongsTo
    {
        return $this->belongsTo(CaptionStyle::class, 'style_id');
    }
}
