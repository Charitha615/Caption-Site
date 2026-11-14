<?php

namespace App\Services\Media;

use App\Jobs\ProcessUploadedVideoJob;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Turns a fully received local file into the project's source video:
 * content-based MIME check → private storage under a random name → MediaFile
 * → processing pipeline. Shared by the single-request and chunked upload paths.
 */
class MediaIngestService
{
    public function __construct(
        protected MediaStorage $storage,
        protected UsageService $usage,
    ) {}

    /**
     * @param  string  $localPath  file on local disk; it is moved into storage
     */
    public function ingest(Project $project, User $user, string $localPath, string $originalName, string $language): MediaFile
    {
        $extension = $this->safeExtension($originalName);
        $mime = $this->detectMime($localPath);
        $size = (int) filesize($localPath);

        if (! in_array($mime, config('captions.uploads.mime_types'), true)) {
            AppLog::warning('upload.rejected_mime', ['project' => $project->uuid, 'detected_mime' => $mime, 'extension' => $extension]);
            throw ValidationException::withMessages(['video' => 'This file is not a supported video. Allowed formats: MP4, MOV, WEBM, MKV, AVI.']);
        }

        $fileUuid = (string) Str::uuid();
        $storedName = "{$fileUuid}.{$extension}";
        $path = "media/{$project->uuid}/{$storedName}";
        $disk = $this->storage->diskName();
        $this->storage->moveLocalFile($localPath, $path, $disk);

        $previous = $project->mediaFiles()->get();

        $media = DB::transaction(function () use ($project, $fileUuid, $path, $storedName, $originalName, $disk, $mime, $size, $extension, $language) {
            $media = MediaFile::create([
                'uuid' => $fileUuid,
                'project_id' => $project->id,
                'file_path' => $path,
                'file_name' => $storedName,
                'original_name' => $this->displayName($originalName, $storedName),
                'disk' => $disk,
                'mime_type' => $mime,
                'file_size' => $size,
                'metadata' => ['extension' => $extension],
            ]);

            $project->update([
                'language' => $language,
                'status' => Project::STATUS_UPLOADED,
                'processing_error' => null,
            ]);

            return $media;
        });

        // A project has one source video: remove the files it replaces.
        foreach ($previous as $old) {
            $this->storage->delete($old->disk, $old->file_path);
            $this->storage->delete($old->disk, $old->audio_path);
            $old->delete();
        }

        $this->usage->record($user, UsageRecord::ACTION_UPLOAD, $size, 'bytes', $project, ['mime' => $mime]);
        AppLog::info('upload.completed', ['project' => $project->uuid, 'media' => $media->uuid, 'bytes' => $size, 'mime' => $mime, 'disk' => $disk]);

        ProcessUploadedVideoJob::dispatch($project, $media, $language);

        return $media;
    }

    public function safeExtension(string $originalName): string
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        return in_array($ext, config('captions.uploads.extensions'), true) ? $ext : 'mp4';
    }

    /** Keeps letters (incl. Sinhala), marks, digits and simple punctuation; never used as a path. */
    public function displayName(string $originalName, string $fallback): string
    {
        $clean = preg_replace('/[^\p{L}\p{M}\p{N}_\-\. ()\x{200C}\x{200D}]/u', '', $originalName) ?? '';

        return mb_substr(trim($clean), 0, 200) ?: $fallback;
    }

    /** MIME type from the file's bytes (libmagic), never from the client. */
    public function detectMime(string $path): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);

        return (string) ($finfo->file($path) ?: 'application/octet-stream');
    }
}
