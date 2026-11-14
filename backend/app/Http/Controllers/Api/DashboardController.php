<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Export;
use App\Models\Project;
use App\Services\Usage\UsageService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use ApiResponseTrait;

    /**
     * Summary metrics, plan usage and recent projects for the dashboard.
     */
    public function index(Request $request, UsageService $usage): JsonResponse
    {
        $user = $request->user();
        $counts = ProjectController::statusCounts($user->id);
        $usageSummary = $usage->summary($user);

        $recentProjects = Project::forUser($user->id)
            ->with('primaryMediaFile')
            ->withCount(['captions', 'mediaFiles'])
            ->latest()
            ->take(6)
            ->get();

        return $this->successResponse([
            'summary' => [
                'total_projects' => $counts['all'],
                'processing_projects' => $counts['processing'],
                'completed_projects' => $counts['ready'],
                'draft_projects' => $counts['draft'],
                'failed_projects' => $counts['failed'],
                'caption_minutes_used' => $usageSummary['caption_minutes']['used'],
                'caption_minutes_limit' => $usageSummary['caption_minutes']['limit'],
                'rendered_videos_count' => Export::where('user_id', $user->id)
                    ->where('type', 'mp4')
                    ->where('status', Export::STATUS_COMPLETED)
                    ->count(),
            ],
            'usage' => $usageSummary,
            'recent_projects' => ProjectResource::collection($recentProjects),
        ], 'Dashboard summary retrieved');
    }
}
