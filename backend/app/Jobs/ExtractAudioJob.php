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

class ExtractAudioJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public Project $project,
        public MediaFile $mediaFile
    ) {}

    public function handle(VideoServiceInterface $videoService): void
    {
        $this->project->update(['status' => Project::STATUS_EXTRACTING_AUDIO]);
        Log::info("Extracting audio stream for project {$this->project->uuid}");

        $videoFullPath = Storage::disk($this->mediaFile->disk)->path($this->mediaFile->file_path);

        $audioDir = storage_path('app/private/audio');
        if (!is_dir($audioDir)) {
            mkdir($audioDir, 0755, true);
        }

        $audioFilename = "{$this->project->uuid}.mp3";
        $audioFullPath = "{$audioDir}/{$audioFilename}";

        $videoService->extractAudio($videoFullPath, $audioFullPath);

        $this->mediaFile->update([
            'audio_path' => "audio/{$audioFilename}",
        ]);

        Log::info("Audio extracted successfully for project {$this->project->uuid}");
    }
}
