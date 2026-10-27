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
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public function __construct(
        protected CreateProjectAction $createAction,
        protected UpdateProjectAction $updateAction,
        protected DeleteProjectAction $deleteAction,
    ) {}

    /**
     * List user projects with status filtering and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Project::forUser($user->id)->withCount(['captions', 'mediaFiles'])->latest();

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->query('per_page', 12), 50);
        $projects = $query->paginate($perPage);

        return $this->successResponse([
            'projects' => ProjectResource::collection($projects),
            'pagination' => [
                'current_page' => $projects->currentPage(),
                'last_page' => $projects->lastPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
            'counts' => [
                'all' => Project::forUser($user->id)->count(),
                'processing' => Project::forUser($user->id)->where('status', 'processing')->count(),
                'completed' => Project::forUser($user->id)->where('status', 'completed')->count(),
                'draft' => Project::forUser($user->id)->where('status', 'draft')->count(),
            ],
        ], 'Projects retrieved');
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

        $project->loadCount(['captions', 'mediaFiles']);

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
    public function destroy(Project $project): JsonResponse
    {
        $this->authorize('delete', $project);

        $this->deleteAction->execute($project);

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
                'phase_label' => 'Processing encountered an error. Please try generating captions again.',
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
            'duration' => $project->duration,
            'width' => $project->width,
            'height' => $project->height,
            'fps' => $project->fps,
            'thumbnail' => $project->thumbnail,
            'language' => $project->language,
            'captions_count' => $captionsCount,
            'updated_at' => $project->updated_at?->toISOString(),
        ], 'Project status retrieved');
    }
}
