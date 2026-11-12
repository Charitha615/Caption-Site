<?php

namespace App\Http\Requests\Exports;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('view', $this->route('project'));
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(config('captions.export_types'))],
            'resolution' => ['nullable', 'string', Rule::in(['source', ...array_keys(config('captions.resolutions'))])],
            'quality' => ['nullable', 'string', Rule::in(array_keys(config('captions.qualities')))],
            'template' => ['nullable', 'uuid'],
        ];
    }
}
