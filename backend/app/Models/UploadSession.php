<?php

namespace App\Models;

use Database\Factories\UploadSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A resumable, chunked upload of one source video. Chunks are written to
 * storage/app/chunks/{uuid}/ and assembled on completion.
 */
class UploadSession extends Model
{
    /** @use HasFactory<UploadSessionFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'uuid',
        'user_id',
        'project_id',
        'original_name',
        'extension',
        'file_size',
        'chunk_size',
        'total_chunks',
        'received_chunks',
        'language',
        'status',
        'expires_at',
    ];

    protected $hidden = ['id', 'user_id', 'project_id'];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'chunk_size' => 'integer',
            'total_chunks' => 'integer',
            'received_chunks' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (UploadSession $session) {
            $session->uuid ??= (string) Str::uuid();
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

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING && $this->expires_at->isFuture();
    }

    /** @return list<int> */
    public function receivedChunks(): array
    {
        return array_values(array_unique(array_map('intval', $this->received_chunks ?? [])));
    }

    /** Expected byte length of chunk $index (the last chunk carries the remainder). */
    public function expectedChunkSize(int $index): int
    {
        if ($index < $this->total_chunks - 1) {
            return $this->chunk_size;
        }

        return $this->file_size - ($this->chunk_size * ($this->total_chunks - 1));
    }

    public function isComplete(): bool
    {
        return count($this->receivedChunks()) === $this->total_chunks;
    }

    public function chunkDirectory(): string
    {
        return storage_path('app/chunks/'.$this->uuid);
    }

    /** @return array<string, mixed> */
    public function toClientArray(): array
    {
        return [
            'uuid' => $this->uuid,
            'status' => $this->status,
            'file_name' => $this->original_name,
            'file_size' => $this->file_size,
            'chunk_size' => $this->chunk_size,
            'total_chunks' => $this->total_chunks,
            'received_chunks' => $this->receivedChunks(),
            'expires_at' => $this->expires_at?->toISOString(),
        ];
    }
}
