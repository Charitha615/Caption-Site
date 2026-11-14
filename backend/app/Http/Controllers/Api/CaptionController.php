<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CaptionResource;
use App\Http\Resources\ProjectResource;
use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Caption;
use App\Models\Project;
use App\Rules\JsonSize;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CaptionController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public const MAX_TEXT_LENGTH = 2000;

    public const MAX_CAPTIONS_PER_PROJECT = 5000;

    public const MAX_TIME_SECONDS = 86400;

    /** @return array<string, list<mixed>> */
    private function captionRules(string $prefix = '', bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            "{$prefix}start_time" => [$req, 'numeric', 'min:0', 'max:'.self::MAX_TIME_SECONDS],
            "{$prefix}end_time" => [$req, 'numeric', 'min:0', 'max:'.self::MAX_TIME_SECONDS],
            "{$prefix}language" => ['nullable', 'string', Rule::in(['si', 'en', 'auto'])],
            "{$prefix}sequence" => ['nullable', 'integer', 'min:1', 'max:1000000'],
            "{$prefix}style_id" => ['nullable', 'integer'],
            "{$prefix}style_override" => ['nullable', 'array', new JsonSize(16 * 1024)],
            "{$prefix}metadata" => ['nullable', 'array', new JsonSize(64 * 1024)],
        ];
    }

    /**
     * List all captions for a project ordered by sequence and start time.
     */
    public function index(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $captions = $project->captions()
            ->orderBy('sequence')
            ->orderBy('start_time')
            ->get();

        return $this->successResponse([
            'captions' => CaptionResource::collection($captions),
            'count' => $captions->count(),
        ], 'Captions retrieved successfully');
    }

    /**
     * Store a newly created caption for a project.
     */
    public function store(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate($this->captionRules() + [
            'text' => ['required', 'string', 'max:'.self::MAX_TEXT_LENGTH],
        ]);
        if ($validated['end_time'] < $validated['start_time']) {
            return $this->errorResponse('End time must be greater than or equal to start time', 422, ['end_time' => ['End time must be after the start time.']]);
        }
        if ($project->captions()->count() >= self::MAX_CAPTIONS_PER_PROJECT) {
            return $this->errorResponse('This project has reached the maximum number of captions.', 422);
        }

        $maxSequence = $project->captions()->max('sequence') ?? 0;

        $caption = $project->captions()->create([
            'uuid' => (string) Str::uuid(),
            'sequence' => $validated['sequence'] ?? ($maxSequence + 1),
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
            'text' => $validated['text'],
            'language' => $validated['language'] ?? ($project->language ?? 'si'),
            'style_id' => $validated['style_id'] ?? null,
            'style_override' => $validated['style_override'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
        ]);

        return $this->successResponse([
            'caption' => new CaptionResource($caption),
        ], 'Caption created successfully', 201);
    }

    /**
     * Update the specified caption.
     */
    public function update(Request $request, Project $project, Caption $caption): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate($this->captionRules('', true) + [
            'text' => ['sometimes', 'string', 'max:'.self::MAX_TEXT_LENGTH],
        ]);

        if (isset($validated['start_time']) && isset($validated['end_time'])) {
            if ($validated['end_time'] < $validated['start_time']) {
                return $this->errorResponse('End time must be greater than or equal to start time', 422);
            }
        } elseif (isset($validated['start_time']) && ! isset($validated['end_time'])) {
            if ($caption->end_time < $validated['start_time']) {
                $validated['end_time'] = $validated['start_time'] + 2.0;
            }
        }

        $caption->update($validated);

        return $this->successResponse([
            'caption' => new CaptionResource($caption),
        ], 'Caption updated successfully');
    }

    /**
     * Remove the specified caption.
     */
    public function destroy(Project $project, Caption $caption): JsonResponse
    {
        $this->authorize('update', $project);

        $caption->delete();

        return $this->successResponse(null, 'Caption deleted successfully');
    }

    /**
     * (Re)generate captions with AI. Replaces the project's captions when it finishes.
     */
    public function generate(Request $request, Project $project, UsageService $usage): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'language' => ['nullable', 'string', Rule::in(['si', 'en', 'auto'])],
        ]);

        $mediaFile = $project->primaryMediaFile;
        if (! $mediaFile) {
            return $this->errorResponse('No video file uploaded for this project yet. Please upload a video first.', 422);
        }
        if ($project->isProcessing()) {
            return $this->errorResponse('Captions are already being generated for this project.', 409);
        }

        $usage->ensureCanRequestAI($request->user());
        $usage->ensureCaptionMinutesRemain($request->user(), (float) ($mediaFile->duration ?: $project->duration ?: 0));

        $language = $validated['language'] ?? ($project->language ?: 'si');
        $project->update([
            'status' => Project::STATUS_UPLOADED,
            'processing_error' => null,
            'language' => $language,
        ]);

        ProcessUploadedVideoJob::dispatch($project, $mediaFile, $language);
        AppLog::info('pipeline.regenerate_requested', ['project' => $project->uuid, 'language' => $language]);

        return $this->successResponse([
            'project' => new ProjectResource($project->fresh()),
            'status' => Project::STATUS_UPLOADED,
        ], 'AI caption generation started', 202);
    }

    /**
     * Batch synchronize all captions for a project (used by editor autosave).
     */
    public function sync(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            // `present` (not `required`) so an editor that deleted every caption can still sync.
            'captions' => ['present', 'array', 'max:'.self::MAX_CAPTIONS_PER_PROJECT],
            'captions.*.uuid' => ['nullable', 'uuid'],
            // Captions may be temporarily empty while being edited.
            'captions.*.text' => ['nullable', 'string', 'max:'.self::MAX_TEXT_LENGTH],
        ] + $this->captionRules('captions.*.'));

        $incomingUuids = [];
        $syncedCaptions = [];

        // UUIDs are globally unique; one that belongs to another project is treated as new.
        $requested = array_filter(array_column($validated['captions'], 'uuid'));
        $foreign = $requested
            ? array_flip(Caption::withTrashed()->whereIn('uuid', $requested)->where('project_id', '!=', $project->id)->pluck('uuid')->all())
            : [];

        DB::transaction(function () use ($project, $validated, $foreign, &$incomingUuids, &$syncedCaptions) {
            foreach ($validated['captions'] as $index => $item) {
                $captionUuid = ! empty($item['uuid']) && ! isset($foreign[$item['uuid']]) ? $item['uuid'] : (string) Str::uuid();
                $incomingUuids[] = $captionUuid;

                // The editor keeps stable client-generated UUIDs, so undoing a delete re-sends a
                // caption that was soft-deleted by a previous sync. Include trashed rows and
                // restore them instead of violating the unique uuid index.
                $caption = Caption::withTrashed()->updateOrCreate(
                    [
                        'project_id' => $project->id,
                        'uuid' => $captionUuid,
                    ],
                    [
                        'sequence' => $item['sequence'] ?? ($index + 1),
                        'start_time' => $item['start_time'],
                        'end_time' => max($item['start_time'] + 0.1, $item['end_time']),
                        'text' => $item['text'] ?? '',
                        'language' => $item['language'] ?? ($project->language ?? 'si'),
                        'style_id' => $item['style_id'] ?? null,
                        'style_override' => $item['style_override'] ?? null,
                        'metadata' => $item['metadata'] ?? null,
                    ]
                );

                if ($caption->trashed()) {
                    $caption->restore();
                }

                $syncedCaptions[] = $caption;
            }

            // Remove any captions deleted in the editor
            $project->captions()->whereNotIn('uuid', $incomingUuids)->delete();
        });

        return $this->successResponse([
            'captions' => CaptionResource::collection(collect($syncedCaptions)),
            'count' => count($syncedCaptions),
        ], 'Captions synchronized successfully');
    }
}
