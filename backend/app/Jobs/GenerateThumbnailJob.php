<?php

namespace App\Jobs;

use App\Models\MediaFile;
use App\Models\Project;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class GenerateThumbnailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 60;

    public function __construct(
        public Project $project,
        public MediaFile $mediaFile
    ) {}

    public function handle(VideoServiceInterface $videoService): void
    {
        Log::info("Generating thumbnail for project {$this->project->uuid}");

        $videoFullPath = Storage::disk($this->mediaFile->disk)->path($this->mediaFile->file_path);

        $thumbDir = storage_path('app/public/thumbnails');
        if (!is_dir($thumbDir)) {
            mkdir($thumbDir, 0755, true);
        }

        $thumbFilename = "{$this->project->uuid}.jpg";
        $thumbFullPath = "{$thumbDir}/{$thumbFilename}";

        // Calculate capture point at 10% or 1 second
        $duration = (float) ($this->project->duration ?: 60.0);
        $timestamp = min(2.0, max(0.5, $duration * 0.1));

        $videoService->generateThumbnail($videoFullPath, $thumbFullPath, $timestamp);

        if (file_exists($thumbFullPath)) {
            $publicUrl = "/storage/thumbnails/{$thumbFilename}";
            $this->project->update(['thumbnail' => $publicUrl]);
            Log::info("Thumbnail generated successfully: {$publicUrl}");
        } else {
            Log::warning("Thumbnail file was not created at {$thumbFullPath}");
        }
    }
}
