<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaFileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'file_name' => $this->file_name,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'duration' => $this->duration,
            'width' => $this->width,
            'height' => $this->height,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
