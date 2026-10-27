<?php

namespace App\Jobs;

use App\Models\Project;
use App\Models\Transcript;
use App\Models\UsageRecord;
use App\Services\AI\Contracts\CaptionAIServiceInterface;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ProcessVideoTranscriptionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 600;

    public function __construct(
        public Project $project,
        public string $targetLanguage = 'si',
    ) {}

    public function handle(
        CaptionAIServiceInterface $aiService,
        VideoServiceInterface $videoService,
    ): void {
        $this->project->update(['status' => 'processing']);

        try {
            $mediaFile = $this->project->primaryMediaFile;
            if (!$mediaFile) {
                throw new \RuntimeException('No media file attached to project.');
            }

            // Generate transcription via AI Service (Gemini)
            $result = $aiService->generateCaptions($mediaFile, $this->targetLanguage);

            // Store transcript
            $transcript = Transcript::create([
                'uuid' => (string) Str::uuid(),
                'project_id' => $this->project->id,
                'media_file_id' => $mediaFile->id,
                'language' => $this->targetLanguage,
                'raw_text' => $result['raw_text'] ?? '',
                'words_json' => $result['words'] ?? [],
                'status' => 'completed',
                'confidence' => 0.95,
            ]);

            // Save individual captions
            foreach ($result['captions'] as $index => $captionData) {
                $this->project->captions()->create([
                    'uuid' => (string) Str::uuid(),
                    'transcript_id' => $transcript->id,
                    'sequence' => $index + 1,
                    'start_time' => $captionData['start_time'],
                    'end_time' => $captionData['end_time'],
                    'text' => $captionData['text'],
                ]);
            }

            // Track usage
            $duration = (float) ($mediaFile->duration ?: 60.0);
            UsageRecord::create([
                'user_id' => $this->project->user_id,
                'project_id' => $this->project->id,
                'action' => 'caption_generation',
                'quantity' => $duration,
                'unit' => 'seconds',
                'metadata' => [
                    'language' => $this->targetLanguage,
                    'captions_count' => count($result['captions']),
                ],
            ]);

            $this->project->update([
                'status' => 'completed',
                'duration' => $duration,
            ]);
        } catch (\Throwable $e) {
            Log::error("Transcription failed for project {$this->project->id}: " . $e->getMessage());
            $this->project->update(['status' => 'failed']);
            throw $e;
        }
    }
}
