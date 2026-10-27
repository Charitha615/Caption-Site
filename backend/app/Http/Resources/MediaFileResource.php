<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaFileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'project_id' => $this->project_id,
            'file_name' => $this->file_name,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'file_size' => $this->file_size,
            'duration' => $this->duration,
            'width' => $this->width,
            'height' => $this->height,
            'audio_path' => $this->audio_path,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
