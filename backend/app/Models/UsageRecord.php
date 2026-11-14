<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class UsageRecord extends Model
{
    use HasFactory;

    /** Seconds of media sent through AI captioning. */
    public const ACTION_CAPTION_GENERATION = 'caption_generation';

    /** One call to an AI provider (metadata: provider, model, tokens). */
    public const ACTION_AI_REQUEST = 'ai_request';

    /** One subtitle/text export (metadata: type). */
    public const ACTION_EXPORT = 'export';

    /** Seconds of video rendered to MP4. */
    public const ACTION_VIDEO_RENDER = 'video_render';

    /** Bytes of source video uploaded. */
    public const ACTION_UPLOAD = 'upload';

    protected $fillable = [
        'uuid',
        'user_id',
        'project_id',
        'action',
        'quantity',
        'unit',
        'metadata',
    ];

    protected $casts = [
        'quantity' => 'float',
        'metadata' => 'array',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (UsageRecord $record) {
            if (empty($record->uuid)) {
                $record->uuid = (string) Str::uuid();
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
