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
use App\Services\AI\GeminiAIProvider;
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
 * structured log. Not retried automatically: a retry would repeat a paid AI call.
 */
class ProcessUploadedVideoJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

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
        return $this->timeout + 60;
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
        } catch (UserFacingException $e) {
            $this->markFailed($project, $e->getMessage());

            return;
        }
        $context = ['project' => $project->uuid, 'media' => $media->uuid, 'language' => $this->targetLanguage, 'provider' => $ai->name()];
        AppLog::info('pipeline.started', $context);

        try {
            $this->phase($project, Project::STATUS_PROCESSING);

            $storage->withMediaCopy($media, function (string $videoPath) use ($project, $media, $user, $video, $ai, $storage, $usage) {
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

                    // 4. Transcribe — the only AI request in the pipeline.
                    $this->phase($project, Project::STATUS_TRANSCRIBING);
                    $usage->ensureCanRequestAI($user);
                    $result = $ai->transcribe($audioTmp, $this->targetLanguage, ['duration' => $meta['duration']]);
                    $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $ai->name()] + $result['usage']);
                } finally {
                    @unlink($audioTmp);
                }

                // 5. Captions
                $this->phase($project, Project::STATUS_GENERATING_CAPTIONS);
                $count = $this->storeCaptions($project, $media, $result);
                $usage->record($user, UsageRecord::ACTION_CAPTION_GENERATION, $meta['duration'], 'seconds', $project, [
                    'language' => $result['language'],
                    'captions_count' => $count,
                ]);
            });

            $project->update(['status' => Project::STATUS_READY, 'processing_error' => null]);
            AppLog::info('pipeline.completed', $context + ['seconds' => round(microtime(true) - $started, 1)]);
        } catch (UserFacingException $e) {
            AppLog::error('pipeline.failed', $context + ['reason' => $e->getMessage()] + $e->context);
            if (($e->context['key_rejected'] ?? false) && $ai instanceof GeminiAIProvider) {
                $this->flagRejectedKey($user);
            }
            $this->markFailed($project, $e->getMessage());
        } catch (Throwable $e) {
            AppLog::error('pipeline.crashed', $context, $e);
            report($e);
            $this->markFailed($project, 'Something went wrong while processing this video. Please try again.');
        }
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

    private function storeCaptions(Project $project, MediaFile $media, array $result): int
    {
        return DB::transaction(function () use ($project, $media, $result) {
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
                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'transcript_id' => $transcript->id,
                    'sequence' => $i + 1,
                    'start_time' => $seg['start'],
                    'end_time' => $seg['end'],
                    'text' => $seg['text'],
                    'language' => $seg['language'],
                    'metadata' => json_encode(['words' => $seg['words']], JSON_UNESCAPED_UNICODE),
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
