<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class Export extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const TEXT_TYPES = ['srt', 'vtt', 'txt', 'json'];
    public const VIDEO_TYPES = ['mp4'];

    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'type',
        'status',
        'progress',
        'file_path',
        'file_size',
        'error_message',
        'metadata',
        'started_at',
        'completed_at',
    ];

    /** file_path is an internal storage key — never serialised to clients. */
    protected $hidden = ['file_path', 'id', 'project_id', 'user_id'];

    protected $casts = [
        'file_size' => 'integer',
        'progress' => 'integer',
        'metadata' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (Export $export) {
            if (empty($export->uuid)) {
                $export->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isFinished(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_FAILED], true);
    }

    public function isDownloadable(): bool
    {
        return $this->status === self::STATUS_COMPLETED && !empty($this->file_path);
    }

    /** Short-lived signed URL; the only way clients ever reach the file. */
    public function temporaryDownloadUrl(): ?string
    {
        if (!$this->isDownloadable()) {
            return null;
        }

        return URL::temporarySignedRoute(
            'exports.download',
            now()->addMinutes((int) config('captions.download_url_ttl_minutes', 30)),
            ['export' => $this->uuid],
        );
    }

    /** Human-friendly, filesystem-safe download name that keeps Sinhala project names readable. */
    public function downloadFileName(): string
    {
        $name = $this->project?->name ?? 'captions';
        // Keep letters (incl. Sinhala), marks, digits; collapse everything else.
        $safe = preg_replace('/[^\p{L}\p{M}\p{N}\x{200C}\x{200D}]+/u', '-', $name) ?? '';
        $safe = trim(mb_substr($safe, 0, 80), '-') ?: 'captions';

        return "{$safe}.{$this->type}";
    }
}
