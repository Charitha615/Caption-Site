<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Export extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'uuid',
        'project_id',
        'user_id',
        'format',
        'status',
        'file_path',
        'file_size',
        'download_url',
        'error_message',
        'metadata',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'metadata' => 'array',
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

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
