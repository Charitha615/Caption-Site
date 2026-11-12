<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CaptionTemplateResource;
use App\Models\CaptionTemplate;
use App\Services\Caption\CaptionStyleNormalizer;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CaptionTemplateController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public const MAX_TEMPLATES_PER_USER = 100;

    public function index(Request $request): JsonResponse
    {
        if (!CaptionTemplate::where('is_system', true)->exists()) {
            CaptionTemplate::syncSystemTemplates(); // first run on a fresh database
        }

        $templates = CaptionTemplate::visibleTo($request->user()->id)
            ->orderByDesc('is_system')
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return $this->successResponse([
            'templates' => CaptionTemplateResource::collection($templates),
        ], 'Templates retrieved');
    }

    public function store(Request $request, CaptionStyleNormalizer $normalizer): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'style' => ['required', 'array'],
            'preview_text' => ['nullable', 'string', 'max:160'],
        ]);

        if ($errors = $normalizer->errors($validated['style'])) {
            throw ValidationException::withMessages(['style' => $errors]);
        }
        if (CaptionTemplate::where('user_id', $request->user()->id)->count() >= self::MAX_TEMPLATES_PER_USER) {
            throw ValidationException::withMessages(['name' => 'You have reached the maximum number of templates.']);
        }

        $template = CaptionTemplate::create([
            'user_id' => $request->user()->id,
            'name' => trim($validated['name']),
            'description' => $validated['description'] ?? null,
            'category' => 'custom',
            'is_system' => false,
            'style' => $normalizer->normalize($validated['style']),
            'preview_text' => $validated['preview_text'] ?? null,
        ]);

        return $this->successResponse(['template' => new CaptionTemplateResource($template)], 'Template saved', 201);
    }

    public function destroy(CaptionTemplate $template): JsonResponse
    {
        $this->authorize('delete', $template);
        $template->delete();

        return $this->successResponse(null, 'Template deleted');
    }
}
