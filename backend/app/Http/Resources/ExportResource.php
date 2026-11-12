<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Never exposes file_path. Downloads only via a short-lived signed URL.
 */
class ExportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $meta = $this->metadata ?? [];

        return [
            'uuid' => $this->uuid,
            'type' => $this->type,
            'status' => $this->status,
            'progress' => (int) $this->progress,
            'file_size' => $this->file_size,
            'error_message' => $this->error_message,
            'options' => array_filter([
                'resolution' => $meta['resolution'] ?? null,
                'quality' => $meta['quality'] ?? null,
                'width' => $meta['width'] ?? null,
                'height' => $meta['height'] ?? null,
                'aspect' => $meta['aspect'] ?? null,
                'template' => $meta['template']['name'] ?? null,
            ], fn ($v) => $v !== null),
            'download_url' => $this->temporaryDownloadUrl(),
            'download_name' => $this->downloadFileName(),
            'created_at' => $this->created_at?->toISOString(),
            'started_at' => $this->started_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
        ];
    }
}
