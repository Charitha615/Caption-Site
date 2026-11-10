<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CaptionResource;
use App\Jobs\GenerateCaptionsJob;
use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Caption;
use App\Models\Project;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CaptionController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

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

        $validated = $request->validate([
            'start_time' => 'required|numeric|min:0',
            'end_time' => 'required|numeric|gte:start_time',
            'text' => 'required|string',
            'language' => 'nullable|string|max:10',
            'sequence' => 'nullable|integer|min:1',
            'style_id' => 'nullable|integer',
            'style_override' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

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

        if ($caption->project_id !== $project->id) {
            return $this->errorResponse('Caption does not belong to this project', 404);
        }

        $validated = $request->validate([
            'start_time' => 'sometimes|numeric|min:0',
            'end_time' => 'sometimes|numeric',
            'text' => 'sometimes|string',
            'language' => 'nullable|string|max:10',
            'sequence' => 'nullable|integer|min:1',
            'style_id' => 'nullable|integer',
            'style_override' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        if (isset($validated['start_time']) && isset($validated['end_time'])) {
            if ($validated['end_time'] < $validated['start_time']) {
                return $this->errorResponse('End time must be greater than or equal to start time', 422);
            }
        } elseif (isset($validated['start_time']) && !isset($validated['end_time'])) {
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

        if ($caption->project_id !== $project->id) {
            return $this->errorResponse('Caption does not belong to this project', 404);
        }

        $caption->delete();

        return $this->successResponse(null, 'Caption deleted successfully');
    }

    /**
     * Trigger AI caption generation for the project.
     */
    public function generate(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $mediaFile = $project->primaryMediaFile;
        if (!$mediaFile) {
            return $this->errorResponse('No video file uploaded for this project yet. Please upload a video first.', 422);
        }

        $language = $request->input('language', $project->language ?? 'si');

        // Update status and dispatch generation job
        $project->update([
            'status' => Project::STATUS_PROCESSING,
            'language' => $language,
        ]);

        // Dispatch pipeline
        ProcessUploadedVideoJob::dispatch($project, $mediaFile, $language);

        return $this->successResponse([
            'project' => $project->fresh(),
            'status' => Project::STATUS_PROCESSING,
        ], 'AI Caption generation started');
    }

    /**
     * Batch synchronize all captions for a project (used by editor autosave).
     */
    public function sync(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            // `present` (not `required`) so an editor that deleted every caption can still sync.
            'captions' => 'present|array',
            'captions.*.uuid' => 'nullable|uuid',
            'captions.*.sequence' => 'nullable|integer',
            'captions.*.start_time' => 'required|numeric|min:0',
            'captions.*.end_time' => 'required|numeric',
            // Captions may be temporarily empty while being edited.
            'captions.*.text' => 'nullable|string',
            'captions.*.language' => 'nullable|string|max:10',
            'captions.*.style_id' => 'nullable|integer',
            'captions.*.style_override' => 'nullable|array',
            'captions.*.metadata' => 'nullable|array',
        ]);

        $incomingUuids = [];
        $syncedCaptions = [];

        \Illuminate\Support\Facades\DB::transaction(function () use ($project, $validated, &$incomingUuids, &$syncedCaptions) {
            foreach ($validated['captions'] as $index => $item) {
                $captionUuid = !empty($item['uuid']) ? $item['uuid'] : (string) Str::uuid();
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
