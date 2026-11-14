<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use App\Models\Project;
use App\Services\Media\MediaStorage;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Serves private media to the browser. Both routes are reachable only through
 * temporary signed URLs issued to the project owner (ProjectResource), so no bearer
 * token is needed in <video>/<img> tags and storage paths are never exposed.
 *
 * - Local disks: BinaryFileResponse with HTTP Range support, so the editor can seek
 *   even on `php artisan serve` (which cannot serve ranges for static files).
 * - Object storage: redirect to a short-lived pre-signed URL from the provider.
 */
class MediaStreamController extends Controller
{
    public function __construct(protected MediaStorage $storage) {}

    public function stream(MediaFile $media): Response
    {
        return $this->serve($media->disk, $media->file_path, $media->mime_type ?: 'video/mp4');
    }

    public function thumbnail(Project $project): Response
    {
        $key = $project->thumbnail;
        abort_if(! $key || preg_match('#^(https?://|/storage/)#i', $key), 404);

        $disk = $project->primaryMediaFile?->disk ?? $this->storage->diskName();

        return $this->serve($disk, $key, 'image/jpeg');
    }

    private function serve(string $disk, string $path, string $mime): BinaryFileResponse|RedirectResponse
    {
        $filesystem = $this->storage->disk($disk);
        abort_unless($filesystem->exists($path), 404);

        if (! $this->storage->isLocal($disk)) {
            return redirect()->away($filesystem->temporaryUrl($path, now()->addMinutes(30), [
                'ResponseContentType' => $mime,
            ]));
        }

        $response = response()->file($filesystem->path($path), [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        $response->headers->set('Accept-Ranges', 'bytes');

        return $response;
    }
}
