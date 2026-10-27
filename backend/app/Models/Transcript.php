<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Transcript extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'project_id',
        'media_file_id',
        'language',
        'raw_text',
        'words_json',
        'status',
        'confidence',
    ];

    protected $casts = [
        'words_json' => 'array',
        'confidence' => 'float',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Transcript $transcript) {
            if (empty($transcript->uuid)) {
                $transcript->uuid = (string) Str::uuid();
            }
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function mediaFile(): BelongsTo
    {
        return $this->belongsTo(MediaFile::class);
    }

    public function captions(): HasMany
    {
        return $this->hasMany(Caption::class);
    }
}
