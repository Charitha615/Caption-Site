<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CaptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'project_id' => $this->project_id,
            'transcript_id' => $this->transcript_id,
            'sequence' => $this->sequence,
            'start_time' => (float) $this->start_time,
            'end_time' => (float) $this->end_time,
            'text' => $this->text,
            'language' => $this->language ?? 'si',
            'style_id' => $this->style_id,
            'style_override' => $this->style_override,
            'metadata' => $this->metadata,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
