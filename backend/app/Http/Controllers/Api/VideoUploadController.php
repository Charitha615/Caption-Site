<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Jobs\ProcessUploadedVideoJob;
use App\Models\MediaFile;
use App\Models\Project;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class VideoUploadController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    /**
     * Upload a video file for a project and initiate the AI captioning pipeline.
     */
    public function upload(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $request->validate([
            'video' => [
                'required',
                'file',
                'max:512000', // 500MB maximum
                'mimetypes:video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/avi',
            ],
            'language' => ['nullable', 'string', 'max:10'],
        ], [
            'video.required' => 'Please select a video file to upload.',
            'video.file' => 'The uploaded file is not a valid file.',
            'video.max' => 'The video file size must not exceed 500MB.',
            'video.mimetypes' => 'Unsupported video format. Allowed formats: MP4, MOV, WEBM, AVI, MKV.',
        ]);

        $file = $request->file('video');

        // Extension security check
        $clientExt = strtolower($file->getClientOriginalExtension());
        $allowedExtensions = ['mp4', 'mov', 'webm', 'avi', 'mkv'];
        $safeExtension = in_array($clientExt, $allowedExtensions, true) ? $clientExt : 'mp4';

        // Generate safe internal filename
        $fileUuid = (string) Str::uuid();
        $safeFilename = "{$fileUuid}.{$safeExtension}";

        // Store using Laravel filesystem abstraction
        $storedPath = $file->storeAs('media', $safeFilename, 'public');

        // Extract client metadata safely
        $originalName = preg_replace('/[^\p{L}\p{N}_\-\. ]/u', '', $file->getClientOriginalName()) ?: "video_{$fileUuid}.{$safeExtension}";
        $mimeType = $file->getClientMimeType() ?: 'video/mp4';
        $fileSize = $file->getSize();

        // Create MediaFile record
        $mediaFile = MediaFile::create([
            'uuid' => $fileUuid,
            'project_id' => $project->id,
            'file_path' => $storedPath,
            'file_name' => $safeFilename,
            'original_name' => $originalName,
            'disk' => 'public',
            'mime_type' => $mimeType,
            'file_size' => $fileSize,
            'metadata' => [
                'original_name' => $originalName,
                'client_mime' => $mimeType,
                'extension' => $safeExtension,
            ],
        ]);

        // Update project status and target language
        $targetLanguage = $request->input('language', $project->language ?: 'si');
        $project->update([
            'language' => $targetLanguage,
            'status' => Project::STATUS_UPLOADED,
        ]);

        // Dispatch queued background processing job
        ProcessUploadedVideoJob::dispatch($project, $mediaFile, $targetLanguage);

        return $this->successResponse([
            'project' => new ProjectResource($project->fresh()),
            'media_file' => [
                'uuid' => $mediaFile->uuid,
                'file_name' => $mediaFile->file_name,
                'original_name' => $mediaFile->original_name,
                'file_size' => $mediaFile->file_size,
                'url' => Storage::disk('public')->url($mediaFile->file_path),
            ],
            'status' => Project::STATUS_UPLOADED,
        ], 'Video uploaded successfully and queued for processing', 201);
    }
}
