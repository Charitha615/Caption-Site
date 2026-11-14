<?php

namespace App\Http\Controllers\Api;

use App\Actions\Projects\CreateProjectAction;
use App\Actions\Projects\DeleteProjectAction;
use App\Actions\Projects\UpdateProjectAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Projects\CreateProjectRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\Usage\UsageService;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public function __construct(
        protected CreateProjectAction $createAction,
        protected UpdateProjectAction $updateAction,
        protected DeleteProjectAction $deleteAction,
    ) {}

    /**
     * List user projects with status filtering, search and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(['all', 'draft', 'processing', 'ready', 'completed', 'failed'])],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $user = $request->user();

        $query = Project::forUser($user->id)
            ->with('primaryMediaFile')
            ->withCount(['captions', 'mediaFiles'])
            ->latest();

        $status = $validated['status'] ?? 'all';
        if ($status === 'processing') {
            $query->whereIn('status', Project::PROCESSING_STATUSES);
        } elseif ($status === 'ready') {
            $query->whereIn('status', [Project::STATUS_READY, Project::STATUS_COMPLETED]);
        } elseif ($status !== 'all') {
            $query->where('status', $status);
        }

        if (! empty($validated['search'])) {
            $like = '%'.addcslashes($validated['search'], '\\%_').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $like)->orWhere('description', 'like', $like));
        }

        $projects = $query->paginate($validated['per_page'] ?? 12);

        return $this->successResponse([
            'projects' => ProjectResource::collection($projects->getCollection()),
            'pagination' => [
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
            'counts' => self::statusCounts($user->id),
        ], 'Projects retrieved');
    }

    /** @return array{all: int, processing: int, ready: int, completed: int, draft: int, failed: int} */
    public static function statusCounts(int $userId): array
    {
        $byStatus = Project::forUser($userId)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'all' => (int) $byStatus->sum(),
            'processing' => (int) $byStatus->only(Project::PROCESSING_STATUSES)->sum(),
            'ready' => (int) ($byStatus[Project::STATUS_READY] ?? 0) + (int) ($byStatus[Project::STATUS_COMPLETED] ?? 0),
            'completed' => (int) ($byStatus[Project::STATUS_COMPLETED] ?? 0),
            'draft' => (int) ($byStatus[Project::STATUS_DRAFT] ?? 0),
            'failed' => (int) ($byStatus[Project::STATUS_FAILED] ?? 0),
        ];
    }

    /**
     * Store a newly created project.
     */
    public function store(CreateProjectRequest $request): JsonResponse
    {
        $project = $this->createAction->execute($request->user(), $request->validated());

        return $this->successResponse([
            'project' => new ProjectResource($project),
        ], 'Project created successfully', 201);
    }

    /**
     * Display the specified project.
     */
    public function show(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $project->load('primaryMediaFile')->loadCount(['captions', 'mediaFiles']);

        return $this->successResponse([
            'project' => new ProjectResource($project),
        ], 'Project retrieved');
    }

    /**
     * Update the specified project.
     */
    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $updated = $this->updateAction->execute($project, $request->validated());

        return $this->successResponse([
            'project' => new ProjectResource($updated),
        ], 'Project updated successfully');
    }

    /**
     * Remove the specified project.
     */
    public function destroy(Project $project, UsageService $usage): JsonResponse
    {
        $this->authorize('delete', $project);

        $this->deleteAction->execute($project);
        $usage->forget($project->user_id);

        return $this->successResponse(null, 'Project deleted successfully');
    }

    /**
     * Get real-time processing status and progress for a project.
     */
    public function status(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $status = $project->status;
        $captionsCount = $project->captions()->count();

        $phaseMeta = match ($status) {
            Project::STATUS_DRAFT => [
                'percentage' => 0,
                'phase' => 'draft',
                'phase_label' => 'Project draft ready for upload',
                'is_processing' => false,
            ],
            Project::STATUS_UPLOADED => [
                'percentage' => 15,
                'phase' => 'upload_complete',
                'phase_label' => 'Video uploaded, queued for processing...',
                'is_processing' => true,
            ],
            Project::STATUS_PROCESSING => [
                'percentage' => 30,
                'phase' => 'analyzing',
                'phase_label' => 'Analyzing video and extracting metadata...',
                'is_processing' => true,
            ],
            Project::STATUS_EXTRACTING_AUDIO => [
                'percentage' => 50,
                'phase' => 'extracting_audio',
                'phase_label' => 'Extracting speech audio stream...',
                'is_processing' => true,
            ],
            Project::STATUS_TRANSCRIBING => [
                'percentage' => 70,
                'phase' => 'transcribing',
                'phase_label' => 'Transcribing speech with AI...',
                'is_processing' => true,
            ],
            Project::STATUS_GENERATING_CAPTIONS => [
                'percentage' => 85,
                'phase' => 'generating_captions',
                'phase_label' => 'Generating timed captions and word timings...',
                'is_processing' => true,
            ],
            Project::STATUS_READY => [
                'percentage' => 100,
                'phase' => 'ready',
                'phase_label' => 'Captions ready! You can now open the project in the editor.',
                'is_processing' => false,
            ],
            Project::STATUS_RENDERING => [
                'percentage' => 90,
                'phase' => 'rendering',
                'phase_label' => 'Rendering captions into video...',
                'is_processing' => true,
            ],
            Project::STATUS_COMPLETED => [
                'percentage' => 100,
                'phase' => 'completed',
                'phase_label' => 'Project processing completed',
                'is_processing' => false,
            ],
            Project::STATUS_FAILED => [
                'percentage' => 0,
                'phase' => 'failed',
                'phase_label' => $project->processing_error ?: 'Processing failed. Please try generating captions again.',
                'is_processing' => false,
            ],
            default => [
                'percentage' => 10,
                'phase' => 'pending',
                'phase_label' => 'Preparing project...',
                'is_processing' => false,
            ],
        };

        return $this->successResponse([
            'uuid' => $project->uuid,
            'status' => $status,
            'progress_percentage' => $phaseMeta['percentage'],
            'phase' => $phaseMeta['phase'],
            'phase_label' => $phaseMeta['phase_label'],
            'is_processing' => $phaseMeta['is_processing'],
            'is_ready' => $status === Project::STATUS_READY || $status === Project::STATUS_COMPLETED,
            'is_failed' => $status === Project::STATUS_FAILED,
            'error' => $status === Project::STATUS_FAILED ? ($project->processing_error ?: 'Processing failed. Please try again.') : null,
            // Seconds the job has waited for a worker; lets the UI flag a stalled queue.
            'phase_seconds' => $phaseMeta['is_processing'] ? (int) $project->updated_at?->diffInSeconds(now(), true) : null,
            'queued_seconds' => $status === Project::STATUS_UPLOADED ? (int) $project->updated_at?->diffInSeconds(now(), true) : null,
            'duration' => $project->duration,
            'width' => $project->width,
            'height' => $project->height,
            'fps' => $project->fps,
            'thumbnail' => $project->thumbnailUrl(),
            'language' => $project->language,
            'captions_count' => $captionsCount,
            'updated_at' => $project->updated_at?->toISOString(),
        ], 'Project status retrieved');
    }
}
