<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class MediaFile extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'project_id',
        'file_path',
        'file_name',
        'original_name',
        'disk',
        'mime_type',
        'file_size',
        'duration',
        'width',
        'height',
        'audio_path',
        'metadata',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'duration' => 'float',
        'width' => 'integer',
        'height' => 'integer',
        'metadata' => 'array',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (MediaFile $mediaFile) {
            if (empty($mediaFile->uuid)) {
                $mediaFile->uuid = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
