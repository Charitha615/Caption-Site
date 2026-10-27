<?php

namespace App\Jobs;

use App\Models\MediaFile;
use App\Models\Project;
use App\Models\Transcript;
use App\Services\AI\AIProviderInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GenerateTranscriptJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 600;

    public function __construct(
        public Project $project,
        public MediaFile $mediaFile,
        public string $language = 'si'
    ) {}

    public function handle(AIProviderInterface $aiProvider): void
    {
        $this->project->update(['status' => Project::STATUS_TRANSCRIBING]);
        Log::info("Generating transcript for project {$this->project->uuid} in language: {$this->language}");

        $audioFullPath = $this->mediaFile->audio_path
            ? storage_path("app/private/{$this->mediaFile->audio_path}")
            : null;

        // If audio file doesn't exist, fallback to video file
        if (!$audioFullPath || !file_exists($audioFullPath)) {
            $audioFullPath = \Illuminate\Support\Facades\Storage::disk($this->mediaFile->disk)->path($this->mediaFile->file_path);
        }

        $transcription = $aiProvider->transcribeAudio($audioFullPath, $this->language);

        $transcript = Transcript::updateOrCreate(
            ['project_id' => $this->project->id],
            [
                'uuid' => (string) Str::uuid(),
                'media_file_id' => $this->mediaFile->id,
                'language' => $transcription['language'] ?? $this->language,
                'raw_text' => $transcription['text'] ?? '',
                'words_json' => $transcription['segments'] ?? [],
                'status' => 'completed',
                'confidence' => 0.96,
            ]
        );

        Log::info("Transcript generated for project {$this->project->uuid}, id: {$transcript->id}");
    }
}
