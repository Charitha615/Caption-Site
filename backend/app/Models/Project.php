<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Project extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_UPLOADED = 'uploaded';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_EXTRACTING_AUDIO = 'extracting_audio';
    public const STATUS_TRANSCRIBING = 'transcribing';
    public const STATUS_GENERATING_CAPTIONS = 'generating_captions';
    public const STATUS_READY = 'ready';
    public const STATUS_RENDERING = 'rendering';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'uuid',
        'user_id',
        'name',
        'description',
        'status',
        'duration',
        'width',
        'height',
        'fps',
        'language',
        'thumbnail',
        'settings',
    ];

    protected $casts = [
        'duration' => 'float',
        'width' => 'integer',
        'height' => 'integer',
        'fps' => 'float',
        'settings' => 'array',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Project $project) {
            if (empty($project->uuid)) {
                $project->uuid = (string) Str::uuid();
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

    public function mediaFiles(): HasMany
    {
        return $this->hasMany(MediaFile::class);
    }

    public function primaryMediaFile(): HasOne
    {
        return $this->hasOne(MediaFile::class)->oldestOfMany();
    }

    public function transcripts(): HasMany
    {
        return $this->hasMany(Transcript::class);
    }

    public function captions(): HasMany
    {
        return $this->hasMany(Caption::class)->orderBy('sequence');
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

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }
}
