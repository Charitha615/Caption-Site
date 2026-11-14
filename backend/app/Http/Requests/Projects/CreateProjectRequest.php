<?php

namespace App\Http\Requests\Projects;

use App\Rules\JsonSize;
use Illuminate\Foundation\Http\FormRequest;

class CreateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** Media properties (duration, size, thumbnail, status) are derived server-side, never accepted. */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'language' => ['nullable', 'string', 'in:si,en,auto'],
            'settings' => ['nullable', 'array', new JsonSize(256 * 1024)],
        ];
    }
}
