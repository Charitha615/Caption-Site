<?php

namespace App\Jobs;

use App\Exceptions\UserFacingException;
use App\Exceptions\VideoProcessingException;
use App\Models\Caption;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\Transcript;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\AI\AIProviderFactory;
use App\Services\Media\MediaStorage;
use App\Services\Usage\UsageService;
use App\Services\Video\Contracts\VideoServiceInterface;
use App\Support\AppLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Throwable;

/**
 * Source video → captions pipeline:
 *
 *   probe (FFprobe) → thumbnail → extract speech audio (FFmpeg)
 *   → transcribe (AI provider, exactly one request) → captions → ready
 *
 * The project's `status` reflects the current phase (polled by the UI). Failures set
 * status=failed with a user-safe `processing_error`; technical detail goes to the
 * structured log. Only "Google is overloaded / timed out" is retried automatically (it is
 * free — no answer means no billed output); every other failure stops immediately.
 */
class ProcessUploadedVideoJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Attempts in total; extra attempts are used only while Google is overloaded. */
    public int $tries = 4;

    /** Minutes to wait before re-trying an overloaded AI, per attempt. */
    public const OVERLOAD_BACKOFF_MINUTES = [1, 3, 5];

    public int $timeout = 1200;

    public bool $failOnTimeout = true;

    public bool $deleteWhenMissingModels = true;

    public function __construct(
        public Project $project,
        public ?MediaFile $mediaFile = null,
        public string $targetLanguage = 'si',
    ) {}

    public function uniqueId(): string
    {
        return $this->project->uuid;
    }

    public function uniqueFor(): int
    {
        return ($this->timeout + 60) * $this->tries + array_sum(self::OVERLOAD_BACKOFF_MINUTES) * 60;
    }

    public function handle(VideoServiceInterface $video, AIProviderFactory $providers, MediaStorage $storage, UsageService $usage): void
    {
        $project = $this->project->fresh();
        $media = $project?->primaryMediaFile;
        if (! $project || ! $media) {
            $this->project->update(['status' => Project::STATUS_FAILED, 'processing_error' => 'No video was found for this project. Please upload it again.']);

            return;
        }
        $user = $project->user;
        $started = microtime(true);
        try {
            $ai = $providers->forUser($user);
            $refiner = $providers->refinerForUser($user);
        } catch (UserFacingException $e) {
            $this->markFailed($project, $e->getMessage());

            return;
        }
        $context = ['project' => $project->uuid, 'media' => $media->uuid, 'language' => $this->targetLanguage, 'provider' => $ai->name()];
        AppLog::info('pipeline.started', $context);

        try {
            $project->update(['processing_error' => null]);
            $this->phase($project, Project::STATUS_PROCESSING);

            $storage->withMediaCopy($media, function (string $videoPath) use ($project, $media, $user, $video, $ai, $refiner, $storage, $usage) {
                // 1. Probe
                $meta = $video->getMetadata($videoPath);
                $media->update([
                    'duration' => $meta['duration'],
                    'width' => $meta['width'],
                    'height' => $meta['height'],
                    'metadata' => array_merge($media->metadata ?? [], array_intersect_key($meta, array_flip(['fps', 'codec', 'audio_codec', 'sample_rate', 'channels', 'has_audio']))),
                ]);
                $project->update(['duration' => $meta['duration'], 'width' => $meta['width'], 'height' => $meta['height'], 'fps' => $meta['fps']]);

                if (! $meta['has_audio']) {
                    throw new VideoProcessingException('This video has no audio track, so there is no speech to caption.');
                }
                $usage->ensureCaptionMinutesRemain($user, $meta['duration']);

                // 2. Thumbnail (best effort)
                $thumbTmp = $storage->tempPath('jpg');
                try {
                    if ($video->generateThumbnail($videoPath, $thumbTmp, min(2.0, max(0.5, $meta['duration'] * 0.1)))) {
                        $thumbKey = "thumbnails/{$project->uuid}.jpg";
                        $storage->putLocalFile($thumbTmp, $thumbKey, $media->disk);
                        $project->update(['thumbnail' => $thumbKey]);
                    }
                } finally {
                    @unlink($thumbTmp);
                }

                // 3. Speech audio
                $this->phase($project, Project::STATUS_EXTRACTING_AUDIO);
                $audioTmp = $storage->tempPath('mp3');
                try {
                    $video->extractAudio($videoPath, $audioTmp);
                    $audioKey = "audio/{$project->uuid}.mp3";
                    $storage->putLocalFile($audioTmp, $audioKey, $media->disk);
                    $media->update(['audio_path' => $audioKey]);

                    // 4. Transcribe (Gemini 3.5 Transcribe → text-model fallback), in chunks for long audio.
                    $this->phase($project, Project::STATUS_TRANSCRIBING);
                    $usage->ensureCanRequestAI($user);
                    $result = $this->transcribe($ai, $video, $storage, $usage, $user, $project, $audioTmp, (float) $meta['duration']);
                } finally {
                    @unlink($audioTmp);
                }

                // 5. Clean up caption text with the text model (timing untouched), then store.
                $this->phase($project, Project::STATUS_GENERATING_CAPTIONS);
                $cleaned = $refiner->refine($result['segments'], $result['language']);
                if ($refiner->model()) {
                    $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => 'gemini-cleanup', 'model' => $refiner->model()]);
                }
                $count = $this->storeCaptions($project, $media, $result, $cleaned, $ai->name(), $refiner->model());
                $usage->record($user, UsageRecord::ACTION_CAPTION_GENERATION, $meta['duration'], 'seconds', $project, [
                    'language' => $result['language'],
                    'captions_count' => $count,
                ]);
            });

            $project->update(['status' => Project::STATUS_READY, 'processing_error' => null]);
            AppLog::info('pipeline.completed', $context + ['seconds' => round(microtime(true) - $started, 1)]);
        } catch (UserFacingException $e) {
            if ($this->retryWhenOverloaded($project, $e)) {
                return;
            }
            AppLog::error('pipeline.failed', $context + ['reason' => $e->getMessage()] + $e->context);
            if (($e->context['key_rejected'] ?? false) && $providers->usesUserKeys()) {
                $this->flagRejectedKey($user);
            }
            $this->markFailed($project, $e->getMessage());
        } catch (Throwable $e) {
            AppLog::error('pipeline.crashed', $context, $e);
            report($e);
            $this->markFailed($project, 'Something went wrong while processing this video. Please try again.');
        }
    }

    /**
     * Google answered "high demand" (or not at all) for every model: queue the job again
     * after a pause instead of failing, and tell the user it will retry by itself.
     */
    private function retryWhenOverloaded(Project $project, UserFacingException $e): bool
    {
        $attempt = $this->job ? $this->attempts() : $this->tries;
        if (! in_array($e->context['reason'] ?? null, ['overloaded', 'timeout'], true) || $attempt >= $this->tries) {
            return false;
        }

        $minutes = self::OVERLOAD_BACKOFF_MINUTES[$attempt - 1] ?? 5;
        $project->update([
            'status' => Project::STATUS_UPLOADED,
            'processing_error' => "Google’s AI is busy right now — retrying automatically in about {$minutes} minute".($minutes > 1 ? 's' : '')." (attempt {$attempt} of ".($this->tries - 1).').',
        ]);
        AppLog::warning('pipeline.retry_scheduled', ['project' => $project->uuid, 'attempt' => $attempt, 'minutes' => $minutes, 'reason' => $e->context['reason']]);
        $this->release($minutes * 60);

        return true;
    }

    /** Timeouts and worker crashes land here. */
    public function failed(?Throwable $exception): void
    {
        AppLog::error('queue.pipeline_job_failed', ['project' => $this->project->uuid], $exception);
        $project = $this->project->fresh();
        if ($project && $project->isProcessing()) {
            $this->markFailed($project, 'Processing took too long or was interrupted. Please try again.');
        }
    }

    /**
     * Transcribes the whole audio, splitting it when it is longer than one request allows,
     * and shifts each chunk's timings back onto the full timeline.
     */
    private function transcribe($ai, VideoServiceInterface $video, MediaStorage $storage, UsageService $usage, User $user, Project $project, string $audioPath, float $duration): array
    {
        $limit = max(60, (int) config('ai.gemini.transcribe_chunk_seconds', 1500));
        if ($duration <= $limit) {
            $result = $ai->transcribe($audioPath, $this->targetLanguage, ['duration' => $duration]);
            $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $ai->name()] + $result['usage']);

            return $result;
        }

        $dir = dirname($storage->tempPath('d')).'/chunks-'.$project->uuid;
        try {
            $merged = ['text' => '', 'language' => $this->targetLanguage, 'segments' => [], 'usage' => []];
            $languages = [];
            foreach ($video->splitAudio($audioPath, $duration, $limit, $dir) as $chunk) {
                $usage->ensureCanRequestAI($user);
                $part = $ai->transcribe($chunk['path'], $this->targetLanguage, ['duration' => $chunk['duration']]);
                $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $ai->name(), 'chunk_offset' => $chunk['offset']] + $part['usage']);
                foreach ($part['segments'] as $seg) {
                    $seg['start'] = round($seg['start'] + $chunk['offset'], 3);
                    $seg['end'] = round($seg['end'] + $chunk['offset'], 3);
                    $seg['words'] = array_map(fn ($w) => ['start' => round($w['start'] + $chunk['offset'], 3), 'end' => round($w['end'] + $chunk['offset'], 3)] + $w, $seg['words'] ?? []);
                    $merged['segments'][] = $seg;
                }
                $merged['text'] = trim($merged['text'].' '.$part['text']);
                $merged['usage'] = $part['usage'];
                $languages[] = $part['language'];
            }
            if ($this->targetLanguage === 'auto' && $languages) {
                $merged['language'] = collect($languages)->countBy()->sortDesc()->keys()->first();
            }

            return $merged;
        } finally {
            File::deleteDirectory($dir);
        }
    }

    /**
     * Stores captions. The transcript row keeps the ORIGINAL transcription (text, segments,
     * word timestamps) untouched; each caption keeps `metadata.original_text` so users can
     * always compare with or restore what the AI heard.
     *
     * @param  list<string>  $cleaned  text-model clean-up, 1:1 with segments
     */
    private function storeCaptions(Project $project, MediaFile $media, array $result, array $cleaned, string $transcriber, ?string $cleanupModel): int
    {
        return DB::transaction(function () use ($project, $media, $result, $cleaned, $transcriber, $cleanupModel) {
            $transcript = Transcript::updateOrCreate(
                ['project_id' => $project->id],
                [
                    'uuid' => Transcript::where('project_id', $project->id)->value('uuid') ?? (string) Str::uuid(),
                    'media_file_id' => $media->id,
                    'language' => $result['language'],
                    'raw_text' => $result['text'],
                    'words_json' => $result['segments'],
                    'status' => 'completed',
                    'confidence' => null,
                ],
            );

            // Regeneration replaces captions; force-delete so stale soft-deleted rows don't pile up.
            Caption::withTrashed()->where('project_id', $project->id)->forceDelete();

            $now = now();
            $rows = [];
            foreach ($result['segments'] as $i => $seg) {
                $text = $cleaned[$i] ?? $seg['text'];
                $words = $seg['words'] ?? [];
                // Keep exact word timings; relabel them only if clean-up kept the same word count.
                $tokens = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
                if ($text !== $seg['text'] && count($tokens) === count($words)) {
                    foreach ($words as $n => &$w) {
                        $w['word'] = $tokens[$n];
                    }
                    unset($w);
                }
                $metadata = array_filter([
                    'words' => $words,
                    'original_text' => $seg['text'],
                    'cleaned' => $text !== $seg['text'],
                    'speaker' => $seg['speaker'] ?? null,
                    'source' => array_filter(['transcriber' => $transcriber, 'cleanup' => $text !== $seg['text'] ? $cleanupModel : null]),
                ], fn ($v) => $v !== null && $v !== []);
                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'transcript_id' => $transcript->id,
                    'sequence' => $i + 1,
                    'start_time' => $seg['start'],
                    'end_time' => $seg['end'],
                    'text' => $text,
                    'language' => $seg['language'],
                    'metadata' => json_encode($metadata, JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                Caption::insert($chunk);
            }

            return count($rows);
        });
    }

    /** Google refused the user's key mid-pipeline: show it as invalid on the Account page. */
    private function flagRejectedKey(User $user): void
    {
        if ($user->hasAiKey()) {
            $user->forceFill(['gemini_key_status' => User::AI_KEY_INVALID, 'gemini_key_checked_at' => now()])->save();
        }
    }

    private function phase(Project $project, string $status): void
    {
        $project->update(['status' => $status]);
    }

    private function markFailed(Project $project, string $message): void
    {
        $project->update(['status' => Project::STATUS_FAILED, 'processing_error' => mb_substr($message, 0, 500)]);
    }
}
