<?php

namespace App\Jobs;

use App\Models\MediaFile;
use App\Models\Project;
use App\Services\AI\AIProviderInterface;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessUploadedVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 900; // 15 minutes max for full pipeline

    public function __construct(
        public Project $project,
        public ?MediaFile $mediaFile = null,
        public string $targetLanguage = 'si'
    ) {
        $this->mediaFile = $mediaFile ?? $this->project->primaryMediaFile;
    }

    public function handle(
        VideoServiceInterface $videoService,
        AIProviderInterface $aiProvider
    ): void {
        Log::info("Starting ProcessUploadedVideoJob pipeline for project {$this->project->uuid}");

        if (!$this->mediaFile) {
            $this->mediaFile = $this->project->primaryMediaFile;
        }

        if (!$this->mediaFile) {
            $this->project->update(['status' => Project::STATUS_FAILED]);
            Log::error("ProcessUploadedVideoJob: No media file found for project {$this->project->uuid}");
            return;
        }

        try {
            // Phase 1: Analyzing video & extracting metadata
            $this->project->update(['status' => Project::STATUS_PROCESSING]);
            (new ExtractVideoMetadataJob($this->project, $this->mediaFile))->handle($videoService);

            // Phase 2: Generating video thumbnail
            (new GenerateThumbnailJob($this->project, $this->mediaFile))->handle($videoService);

            // Phase 3: Extracting speech audio stream
            $this->project->update(['status' => Project::STATUS_EXTRACTING_AUDIO]);
            (new ExtractAudioJob($this->project, $this->mediaFile))->handle($videoService);

            // Phase 4: Transcribing speech
            $this->project->update(['status' => Project::STATUS_TRANSCRIBING]);
            (new GenerateTranscriptJob($this->project, $this->mediaFile, $this->targetLanguage))->handle($aiProvider);

            // Phase 5: Generating timed captions & word alignments
            $this->project->update(['status' => Project::STATUS_GENERATING_CAPTIONS]);
            (new GenerateCaptionsJob($this->project, $this->targetLanguage))->handle($aiProvider);

            // Final state: Ready!
            $this->project->update(['status' => Project::STATUS_READY]);
            Log::info("ProcessUploadedVideoJob pipeline completed successfully for project {$this->project->uuid}");
        } catch (\Throwable $e) {
            Log::error("ProcessUploadedVideoJob pipeline failed for project {$this->project->uuid}: " . $e->getMessage(), [
                'exception' => $e,
            ]);
            $this->project->update(['status' => Project::STATUS_FAILED]);
            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("ProcessUploadedVideoJob permanently failed for project {$this->project->uuid}: " . $exception->getMessage());
        $this->project->update(['status' => Project::STATUS_FAILED]);
    }
}
