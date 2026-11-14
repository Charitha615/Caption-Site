<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\Media\MediaIngestService;
use App\Services\Usage\UsageService;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Single-request upload for small files and API clients. The web app uses the
 * chunked, resumable flow in UploadSessionController for anything large.
 */
class VideoUploadController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public function upload(Request $request, Project $project, MediaIngestService $ingest, UsageService $usage): JsonResponse
    {
        $this->authorize('update', $project);

        if ($project->isProcessing()) {
            return $this->errorResponse('This project is still processing. Please wait for it to finish.', 409);
        }

        $maxKb = (int) ($usage->limits($request->user())['max_upload_mb'] ?? 500) * 1024;
        $request->validate([
            'video' => ['required', 'file', "max:{$maxKb}", 'extensions:'.implode(',', config('captions.uploads.extensions'))],
            'language' => ['nullable', 'string', Rule::in(['si', 'en', 'auto'])],
        ], [
            'video.required' => 'Please select a video file to upload.',
            'video.max' => 'The video is larger than your plan allows.',
            'video.extensions' => 'Unsupported video format. Allowed formats: MP4, MOV, WEBM, MKV, AVI.',
        ]);

        $file = $request->file('video');
        $usage->ensureCanUpload($request->user(), (int) $file->getSize());

        $media = $ingest->ingest(
            $project,
            $request->user(),
            $file->getRealPath(),
            $file->getClientOriginalName(),
            $request->input('language', $project->language ?: 'si'),
        );

        return $this->successResponse([
            'project' => new ProjectResource($project->fresh()),
            'media_file' => [
                'uuid' => $media->uuid,
                'original_name' => $media->original_name,
                'file_size' => $media->file_size,
            ],
            'status' => Project::STATUS_UPLOADED,
        ], 'Video uploaded successfully and queued for processing', 201);
    }
}
