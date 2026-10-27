<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    use ApiResponseTrait;

    /**
     * Get dashboard summary metrics and recent projects.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $totalProjects = Project::forUser($user->id)->count();
        $processingProjects = Project::forUser($user->id)->where('status', 'processing')->count();
        $completedProjects = Project::forUser($user->id)->where('status', 'completed')->count();
        $draftProjects = Project::forUser($user->id)->where('status', 'draft')->count();

        $totalCaptionSeconds = (float) UsageRecord::where('user_id', $user->id)
            ->where('action', 'caption_generation')
            ->sum('quantity');

        $totalVideoSeconds = (float) UsageRecord::where('user_id', $user->id)
            ->where('action', 'video_render')
            ->sum('quantity');

        $recentProjects = Project::forUser($user->id)
            ->withCount(['captions', 'mediaFiles'])
            ->latest()
            ->take(6)
            ->get();

        return $this->successResponse([
            'summary' => [
                'total_projects' => $totalProjects,
                'processing_projects' => $processingProjects,
                'completed_projects' => $completedProjects,
                'draft_projects' => $draftProjects,
                'caption_minutes_used' => round($totalCaptionSeconds / 60, 1),
                'caption_minutes_limit' => 120, // Free tier default 120 mins
                'rendered_videos_count' => Project::forUser($user->id)->has('exports')->count(),
            ],
            'recent_projects' => ProjectResource::collection($recentProjects),
        ], 'Dashboard summary retrieved');
    }
}
