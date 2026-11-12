<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Streams a project's source video to the editor.
 *
 * - Supports HTTP Range requests (BinaryFileResponse), so the <video> element can
 *   seek on any server — PHP's built-in dev server (`php artisan serve`) cannot
 *   serve ranges for static files, which made videos unseekable in development.
 * - Reached only via a temporary signed URL issued to the project owner in
 *   ProjectResource::video_url; the storage path is never exposed.
 */
class MediaStreamController extends Controller
{
    public function stream(MediaFile $media): BinaryFileResponse
    {
        $disk = Storage::disk($media->disk);
        abort_unless($disk->exists($media->file_path), 404);

        $response = response()->file($disk->path($media->file_path), [
            'Content-Type' => $media->mime_type ?: 'video/mp4',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        $response->headers->set('Accept-Ranges', 'bytes');

        return $response;
    }
}
