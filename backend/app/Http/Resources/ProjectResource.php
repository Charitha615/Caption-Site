<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'processing_error' => $this->status === 'failed' ? $this->processing_error : null,
            'duration' => $this->duration,
            'width' => $this->width,
            'height' => $this->height,
            'fps' => $this->fps,
            'language' => $this->language,
            'thumbnail' => $this->thumbnailUrl(),
            'video_url' => $this->primaryMediaFile?->streamUrl(),
            'settings' => $this->settings,
            'captions_count' => $this->whenCounted('captions', $this->captions_count),
            'media_files_count' => $this->whenCounted('mediaFiles', $this->media_files_count),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
