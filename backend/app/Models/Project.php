<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\URL;
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
        'processing_error',
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

    /** The current source video. Re-uploading replaces it (older files are removed). */
    public function primaryMediaFile(): HasOne
    {
        return $this->hasOne(MediaFile::class)->latestOfMany();
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

    public function uploadSessions(): HasMany
    {
        return $this->hasMany(UploadSession::class);
    }

    /** Statuses during which the processing pipeline is running. */
    public const PROCESSING_STATUSES = [
        self::STATUS_UPLOADED,
        self::STATUS_PROCESSING,
        self::STATUS_EXTRACTING_AUDIO,
        self::STATUS_TRANSCRIBING,
        self::STATUS_GENERATING_CAPTIONS,
    ];

    public function isProcessing(): bool
    {
        return in_array($this->status, self::PROCESSING_STATUSES, true);
    }

    /**
     * Browser-usable thumbnail URL. Generated thumbnails live on the private media
     * disk and are served through a signed route; absolute URLs (seed data) pass through.
     */
    public function thumbnailUrl(): ?string
    {
        $thumb = $this->thumbnail;
        if (! $thumb) {
            return null;
        }
        if (preg_match('#^https?://#i', $thumb)) {
            return $thumb;
        }
        if (str_starts_with($thumb, '/storage/')) {
            return url($thumb); // legacy public-disk thumbnails
        }

        return URL::temporarySignedRoute(
            'projects.thumbnail',
            now()->addMinutes((int) config('captions.stream_url_ttl_minutes', 720)),
            ['project' => $this->uuid, 'v' => substr(md5($thumb.$this->updated_at), 0, 8)],
        );
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
