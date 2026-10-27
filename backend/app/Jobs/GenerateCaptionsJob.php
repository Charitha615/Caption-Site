<?php

namespace App\Jobs;

use App\Models\Caption;
use App\Models\Project;
use App\Models\Transcript;
use App\Models\UsageRecord;
use App\Services\AI\AIProviderInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GenerateCaptionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public Project $project,
        public string $language = 'si'
    ) {}

    public function handle(AIProviderInterface $aiProvider): void
    {
        $this->project->update(['status' => Project::STATUS_GENERATING_CAPTIONS]);
        Log::info("Generating captions for project {$this->project->uuid}");

        $mediaFile = $this->project->primaryMediaFile;
        $audioFullPath = $mediaFile?->audio_path
            ? storage_path("app/private/{$mediaFile->audio_path}")
            : null;

        if (!$audioFullPath || !file_exists($audioFullPath)) {
            $audioFullPath = $mediaFile
                ? \Illuminate\Support\Facades\Storage::disk($mediaFile->disk)->path($mediaFile->file_path)
                : '';
        }

        // Get structured caption segments from AI provider
        $captionsData = $aiProvider->generateCaptions($audioFullPath, $this->language);

        // Find or associate transcript
        $transcript = Transcript::where('project_id', $this->project->id)->first();

        // Remove old generated captions to avoid duplicate sequence collisions
        $this->project->captions()->delete();

        $insertedCount = 0;
        foreach ($captionsData as $index => $cap) {
            Caption::create([
                'uuid' => (string) Str::uuid(),
                'project_id' => $this->project->id,
                'transcript_id' => $transcript?->id,
                'sequence' => $index + 1,
                'start_time' => $cap['start'],
                'end_time' => $cap['end'],
                'text' => $cap['text'],
                'language' => $cap['language'] ?? $this->language,
                'metadata' => [
                    'words' => $cap['words'] ?? [],
                ],
            ]);
            $insertedCount++;
        }

        // Track usage in seconds
        $duration = (float) ($this->project->duration ?: 60.0);
        UsageRecord::create([
            'user_id' => $this->project->user_id,
            'project_id' => $this->project->id,
            'action' => 'caption_generation',
            'quantity' => $duration,
            'unit' => 'seconds',
            'metadata' => [
                'language' => $this->language,
                'captions_count' => $insertedCount,
            ],
        ]);

        // Mark project as ready!
        $this->project->update([
            'status' => Project::STATUS_READY,
        ]);

        Log::info("Captions generated successfully ({$insertedCount} lines) for project {$this->project->uuid}");
    }
}
