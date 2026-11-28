<?php

namespace App\Models;

use Database\Factories\VideoProjectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/** A video editor project saved to the account: its layout only, never the media files. */
class VideoProject extends Model
{
    /** @use HasFactory<VideoProjectFactory> */
    use HasFactory;

    protected $fillable = ['name', 'aspect', 'duration', 'clip_count', 'data', 'thumb'];

    protected static function booted(): void
    {
        static::creating(function (VideoProject $project) {
            $project->uuid ??= (string) Str::uuid();
        });
    }

    protected function casts(): array
    {
        return ['duration' => 'float', 'clip_count' => 'integer'];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
