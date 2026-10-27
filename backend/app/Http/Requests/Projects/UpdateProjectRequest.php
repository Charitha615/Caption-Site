<?php

namespace App\Http\Requests\Projects;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'string', 'in:draft,uploading,processing,completed,failed'],
            'language' => ['sometimes', 'string', 'in:si,en,auto'],
            'duration' => ['nullable', 'numeric', 'min:0'],
            'width' => ['nullable', 'integer', 'min:1'],
            'height' => ['nullable', 'integer', 'min:1'],
            'fps' => ['nullable', 'numeric', 'min:1'],
            'thumbnail' => ['nullable', 'string'],
            'settings' => ['nullable', 'array'],
        ];
    }
}
