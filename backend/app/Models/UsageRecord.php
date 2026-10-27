<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class UsageRecord extends Model
{
    use HasFactory;

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
