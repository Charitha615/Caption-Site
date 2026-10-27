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

class ExtractVideoMetadataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;

    public function __construct(
        public Project $project,
        public MediaFile $mediaFile
    ) {}

    public function handle(VideoServiceInterface $videoService): void
    {
        Log::info("Extracting metadata for project {$this->project->uuid}");

        $fullPath = Storage::disk($this->mediaFile->disk)->path($this->mediaFile->file_path);

        $meta = $videoService->getMetadata($fullPath);

        $this->mediaFile->update([
            'duration' => $meta['duration'] ?? 60.0,
            'width' => $meta['width'] ?? 1920,
            'height' => $meta['height'] ?? 1080,
            'metadata' => [
                'fps' => $meta['fps'] ?? 30.0,
                'codec' => $meta['codec'] ?? 'h264',
                'audio_codec' => $meta['audio_codec'] ?? 'aac',
                'sample_rate' => $meta['sample_rate'] ?? 44100,
                'channels' => $meta['channels'] ?? 2,
            ],
        ]);

        $this->project->update([
            'duration' => $meta['duration'] ?? 60.0,
            'width' => $meta['width'] ?? 1920,
            'height' => $meta['height'] ?? 1080,
            'fps' => $meta['fps'] ?? 30.0,
        ]);

        Log::info("Metadata extraction complete for project {$this->project->uuid}", $meta);
    }
}
