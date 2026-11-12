<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CaptionTemplateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'category' => $this->category,
            'is_system' => $this->is_system,
            'is_owner' => $request->user()?->id === $this->user_id,
            'style' => $this->style,
            'preview_text' => $this->preview_text,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
