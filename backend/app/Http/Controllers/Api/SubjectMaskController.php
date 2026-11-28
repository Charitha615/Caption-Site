<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\Rendering\SubjectMaskStore;
use App\Services\Usage\UsageService;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * "Captions behind the person" (Pro): the person's outline through the project's video, found in
 * the browser and uploaded before the MP4 export (see SubjectMaskStore).
 */
class SubjectMaskController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public function __construct(protected SubjectMaskStore $masks) {}

    public function show(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        return $this->successResponse(['ready' => $this->masks->isReady($project)], 'Person outline status');
    }

    public function update(Request $request, Project $project, UsageService $usage): JsonResponse
    {
        $this->authorize('update', $project);
        $usage->ensureCanUseStyles($request->user(), [], [], behindSubject: true);
        if (! $project->primaryMediaFile) {
            throw ValidationException::withMessages(['mask' => 'Upload a video to this project first.']);
        }

        $info = $this->masks->save($project, $request->getContent());

        return $this->successResponse(['ready' => true, 'frames' => $info['frames']], 'Person outline saved');
    }
}
