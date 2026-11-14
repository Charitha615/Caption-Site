<?php

namespace App\Http\Requests\Projects;

use App\Rules\JsonSize;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('project'));
    }

    /** `settings` holds editor state (style, presets, canvas); capped to keep rows small. */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'language' => ['sometimes', 'string', 'in:si,en,auto'],
            'settings' => ['sometimes', 'array', new JsonSize(256 * 1024)],
        ];
    }
}
