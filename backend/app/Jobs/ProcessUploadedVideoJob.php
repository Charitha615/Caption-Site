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
use App\Services\AI\CaptionRefinerInterface;
use App\Services\AI\GeminiMixedTranscriber;
use App\Services\Caption\EnglishWords;
use App\Services\Caption\ScriptAligner;
use App\Services\Caption\SinhalaScriptRepair;
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
use Illuminate\Support\Facades\Cache;
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

    public int $timeout = 2700;

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
            $mixed = $providers->mixedTranscriberForUser($user);
            $corrector = $providers->captionCorrector();
        } catch (UserFacingException $e) {
            $this->markFailed($project, $e->getMessage());

            return;
        }
        $context = ['project' => $project->uuid, 'media' => $media->uuid, 'language' => $this->targetLanguage, 'provider' => $ai->name()];
        AppLog::info('pipeline.started', $context);

        try {
            $project->update(['processing_error' => null]);
            $this->phase($project, Project::STATUS_PROCESSING);

            $storage->withMediaCopy($media, function (string $videoPath) use ($project, $media, $user, $video, $ai, $refiner, $mixed, $corrector, $storage, $usage) {
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
                    $leadIn = max(0.0, (float) config('ai.audio_lead_in_seconds', 1.0));
                    $video->extractAudio($videoPath, $audioTmp, $leadIn);
                    $audioKey = "audio/{$project->uuid}.mp3";
                    $storage->putLocalFile($audioTmp, $audioKey, $media->disk);
                    $media->update(['audio_path' => $audioKey]);

                    // 4. Transcribe + review, part by part (Gemini 3.5 Transcribe → Flash listening review).
                    $this->phase($project, Project::STATUS_TRANSCRIBING);
                    $usage->ensureCanRequestAI($user);
                    // With the user's own script, the transcript is only needed for speech timings.
                    $script = trim((string) $project->script);
                    $result = $this->transcribe($ai, $refiner, $script === '' ? $mixed : null, $video, $storage, $usage, $user, $project, $audioTmp, (float) $meta['duration'] + $leadIn, review: $script === '');
                    $result = self::shiftTimeline($result, -$leadIn, (float) $meta['duration']);
                } finally {
                    @unlink($audioTmp);
                }

                // 5. Store: reviewed text + re-derived word timings; the original transcription is kept.
                $this->phase($project, Project::STATUS_GENERATING_CAPTIONS);
                $cleaned = array_map(fn ($seg) => $seg['reviewed_text'] ?? $seg['text'], $result['segments']);
                $scriptLines = $script !== ''
                    ? $this->scriptCaptions($script, $result, (float) $meta['duration'], $refiner, $usage, $user, $project)
                    : ($result['lines'] ?? null); // mixed-script (Flash) captions, when used
                if ($corrector && $script === '') {
                    [$result, $cleaned, $scriptLines] = $this->correctCaptions($corrector, $result, $cleaned, $scriptLines, $usage, $user, $project);
                }
                $count = $this->storeCaptions($project, $media, $result, $cleaned, $ai->name(), $refiner->model(), $scriptLines);
                if ($this->targetLanguage === 'auto' && in_array($result['language'], ['si', 'en'], true)) {
                    $project->update(['language' => $result['language']]); // detected language
                }
                $usage->record($user, UsageRecord::ACTION_CAPTION_GENERATION, $meta['duration'], 'seconds', $project, [
                    'language' => $result['language'],
                    'captions_count' => $count,
                ]);
            });

            Cache::forget(self::progressKey($project));
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
            'processing_error' => "Google is busy right now — retrying automatically in about {$minutes} minute".($minutes > 1 ? 's' : '')." (attempt {$attempt} of ".($this->tries - 1).').',
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
     * Moves every caption and word by $delta seconds (removing the silent lead-in), clamped to
     * [0, duration]. Lines that end up empty in time are dropped.
     */
    public static function shiftTimeline(array $result, float $delta, float $duration): array
    {
        if ($delta == 0.0) {
            return $result;
        }
        $clamp = fn (float $t) => round(min(max($t + $delta, 0.0), $duration), 3);
        $segments = [];
        foreach ($result['segments'] as $seg) {
            $seg['start'] = $clamp((float) $seg['start']);
            $seg['end'] = $clamp((float) $seg['end']);
            if ($seg['end'] - $seg['start'] < 0.05) {
                if ($seg['start'] >= $duration) {
                    continue;
                }
                $seg['end'] = min($duration, $seg['start'] + 0.3);
            }
            foreach (['words', 'reviewed_words'] as $key) {
                if (isset($seg[$key])) {
                    $seg[$key] = array_map(fn ($w) => ['start' => $clamp((float) $w['start']), 'end' => $clamp((float) $w['end'])] + $w, $seg[$key]);
                }
            }
            $segments[] = $seg;
        }
        $result['segments'] = $segments;
        if (isset($result['lines'])) {
            $lines = [];
            foreach ($result['lines'] as $line) {
                $line['start'] = $clamp((float) $line['start']);
                $line['end'] = $clamp((float) $line['end']);
                if ($line['end'] - $line['start'] < 0.05 && $line['start'] >= $duration) {
                    continue;
                }
                $line['end'] = max($line['end'], min($duration, $line['start'] + 0.3));
                $line['words'] = array_map(fn ($w) => ['start' => $clamp((float) $w['start']), 'end' => $clamp((float) $w['end'])] + $w, $line['words']);
                $lines[] = $line;
            }
            $result['lines'] = $lines;
        }

        return $result;
    }

    /**
     * Transcribes the audio in short parts cut at natural pauses. Each part, in order:
     * 1. transcribe it, 2. repair wrong-script Sinhala, 3. have the text model LISTEN to that
     * part and correct its lines (misheard words, English words, missing words), 4. re-time the
     * corrected words from the transcriber's word timestamps — then move on to the next part.
     * The transcriber's own text and words stay on each segment as the original.
     */
    private function transcribe($ai, CaptionRefinerInterface $refiner, ?GeminiMixedTranscriber $mixed, VideoServiceInterface $video, MediaStorage $storage, UsageService $usage, User $user, Project $project, string $audioPath, float $duration, bool $review = true): array
    {
        $target = min(1800, max(20, (int) config('ai.gemini.transcribe_chunk_seconds', 30)));
        $listen = (bool) config('ai.gemini.caption_review', true);
        $repair = app(SinhalaScriptRepair::class);
        $aligner = app(ScriptAligner::class);
        $english = app(EnglishWords::class);
        $dir = dirname($storage->tempPath('d')).'/chunks-'.$project->uuid;

        try {
            $parts = $duration > $target * 1.3
                ? $video->splitAudio($audioPath, $duration, $target, $dir)
                : [['path' => $audioPath, 'offset' => 0.0, 'duration' => $duration]];
            $merged = ['text' => '', 'language' => $this->targetLanguage, 'segments' => [], 'usage' => []];
            $languages = [];
            $stats = ['repaired' => 0, 'reviewed' => 0, 'english' => 0, 'mixed' => 0, 'mixed_rejected' => 0];
            $lines = [];

            foreach ($parts as $n => $part) {
                $this->progress($project, $n + 1, count($parts));
                $usage->ensureCanRequestAI($user);
                $result = $ai->transcribe($part['path'], $this->targetLanguage, ['duration' => $part['duration']]);
                $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $ai->name(), 'part' => $n + 1, 'offset' => $part['offset']] + $result['usage']);

                $segments = array_map(fn ($seg) => $seg + ['transcribed_text' => $seg['text']], $result['segments']);
                [$segments, $repaired] = $repair->repairSegments($segments);
                $stats['repaired'] += $repaired;

                // Mixed-script words from the prompted Flash model, lined up with the heard words' timings.
                $flashLines = $mixed ? $this->mixedLines($mixed, $part, $segments, $result['language'], $project, $usage, $user, $n + 1, $stats) : null;

                if ($flashLines === null && $segments !== [] && $review) {
                    $reviewed = $refiner->refine($segments, $result['language'], $listen ? $part['path'] : null);
                    if ($refiner->model()) {
                        $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $listen ? 'gemini-review' : 'gemini-cleanup', 'model' => $refiner->model(), 'part' => $n + 1]);
                    }
                    foreach ($segments as $i => &$seg) {
                        $text = trim((string) ($reviewed[$i] ?? $seg['text']));
                        if ($text !== '' && $text !== $seg['text']) {
                            $seg['reviewed_text'] = $text;
                            $seg['reviewed_words'] = $aligner->alignWords($text, $seg['words'] ?? [], (float) $seg['start'], (float) $seg['end']);
                            $stats['reviewed']++;
                        }
                    }
                    unset($seg);
                }

                // English words spoken in Sinhala speech → English letters (built-in list, always runs,
                // so it still works when the AI review was busy or missed some).
                foreach ($segments as &$seg) {
                    $line = $english->applyToLine($seg['reviewed_text'] ?? $seg['text'], $seg['reviewed_words'] ?? $seg['words'] ?? []);
                    if ($line['changed']) {
                        $seg['reviewed_text'] = $line['text'];
                        $seg['reviewed_words'] = $line['words'];
                        $stats['english']++;
                    }
                }
                unset($seg);

                $offset = (float) $part['offset'];
                $shift = fn (array $words) => array_map(fn ($w) => ['start' => round($w['start'] + $offset, 3), 'end' => round($w['end'] + $offset, 3)] + $w, $words);

                // Caption lines for this part: Flash words, or (fallback) the reviewed transcription.
                foreach ($flashLines ?? array_map(fn ($seg) => [
                    'start' => (float) $seg['start'],
                    'end' => (float) $seg['end'],
                    'text' => $seg['reviewed_text'] ?? $seg['text'],
                    'original' => $seg['transcribed_text'] ?? $seg['text'],
                    'language' => $seg['language'],
                    'words' => array_map(fn ($w) => ['word' => (string) ($w['word'] ?? $w['text'] ?? ''), 'start' => (float) $w['start'], 'end' => (float) $w['end']], $seg['reviewed_words'] ?? $seg['words'] ?? []),
                    'source' => ['transcriber' => $ai->name()],
                    'meta' => array_filter(['reviewed' => isset($seg['reviewed_text']) ? true : null, 'speaker' => $seg['speaker'] ?? null]),
                ], $segments) as $line) {
                    $line['start'] = round($line['start'] + $offset, 3);
                    $line['end'] = round($line['end'] + $offset, 3);
                    $line['words'] = $shift($line['words']);
                    $lines[] = $line;
                }
                foreach ($segments as $seg) {
                    $seg['start'] = round($seg['start'] + $offset, 3);
                    $seg['end'] = round($seg['end'] + $offset, 3);
                    $seg['words'] = $shift($seg['words'] ?? []);
                    if (isset($seg['reviewed_words'])) {
                        $seg['reviewed_words'] = $shift($seg['reviewed_words']);
                    }
                    $merged['segments'][] = $seg;
                }
                $merged['text'] = trim($merged['text'].' '.$result['text']);
                $merged['usage'] = $result['usage'];
                $languages[] = $result['language'];
            }
            if ($this->targetLanguage === 'auto' && $languages) {
                $merged['language'] = collect($languages)->countBy()->sortDesc()->keys()->first();
            } elseif (count($languages) === 1) {
                $merged['language'] = $languages[0];
            }
            if ($stats['mixed'] > 0) {
                $merged['lines'] = $lines;
            }
            AppLog::info('pipeline.transcribed', ['project' => $project->uuid, 'parts' => count($parts), 'lines' => count($lines)] + $stats);

            return $merged;
        } finally {
            File::deleteDirectory($dir);
        }
    }

    /**
     * One part with the prompted Flash model: its mixed-script words, repaired and with the
     * English word list applied, lined up with the words the transcribe model heard (exact
     * timings; words it missed are placed in the gaps). Null → use the transcription instead.
     *
     * @return list<array<string, mixed>>|null caption lines, part-relative times
     */
    private function mixedLines(GeminiMixedTranscriber $mixed, array $part, array $segments, string $language, Project $project, UsageService $usage, User $user, int $partNumber, array &$stats): ?array
    {
        $speech = collect($segments)
            ->flatMap(fn ($seg) => $seg['words'] ?? [])
            ->filter(fn ($w) => isset($w['start'], $w['end']) && trim((string) ($w['word'] ?? $w['text'] ?? '')) !== '')
            ->map(fn ($w) => ['word' => (string) ($w['word'] ?? $w['text']), 'start' => (float) $w['start'], 'end' => (float) $w['end']])
            ->sortBy('start')->values()->all();

        $usage->ensureCanRequestAI($user);
        $text = $mixed->transcribe($part['path'], $language, (string) $project->vocabulary);
        if ($mixed->model()) {
            $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => 'gemini-mixed', 'model' => $mixed->model(), 'part' => $partNumber]);
        }
        if ($text === null) {
            return null; // every model busy: fall back to the transcription
        }
        if ($text === '' && $speech === []) {
            $stats['mixed']++;

            return []; // no speech in this part
        }
        if (! GeminiMixedTranscriber::plausible($text, count($speech), (float) $part['duration'])) {
            $stats['mixed_rejected']++;
            AppLog::warning('pipeline.mixed_rejected', ['project' => $project->uuid, 'part' => $partNumber, 'heard_words' => count($speech), 'flash_words' => count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [])]);

            return null;
        }

        $text = app(EnglishWords::class)->apply(app(SinhalaScriptRepair::class)->repair($text));
        $aligned = app(ScriptAligner::class)->align($text, $speech, (float) $part['duration'], $language);
        $stats['mixed']++;

        return array_map(fn ($seg) => [
            'start' => (float) $seg['start'],
            'end' => (float) $seg['end'],
            'text' => $seg['text'],
            'original' => $seg['text'],
            'language' => $seg['language'],
            'words' => $seg['words'],
            'source' => ['transcriber' => $mixed->model(), 'timing' => 'gemini-transcribe'],
            'meta' => ['matched_words' => $aligned['stats']['matched'], 'placed_words' => $aligned['stats']['placed']],
        ], $aligned['segments']);
    }

    public static function progressKey(Project $project): string
    {
        return "project:{$project->uuid}:transcribe-progress";
    }

    /** "Part X of N" for the status endpoint; also refreshes updated_at so the UI doesn't think it stalled. */
    private function progress(Project $project, int $part, int $parts): void
    {
        Cache::put(self::progressKey($project), ['part' => $part, 'parts' => $parts], now()->addHours(2));
        $project->touch();
    }

    /**
     * Captions from the user's own script: Sinhala script repaired, English words written in
     * Sinhala letters moved to English (best effort), every word lined up with the speech
     * timings, then punctuation removed. Each line keeps the script text as its original.
     *
     * @return list<array{start: float, end: float, text: string, original: string, language: string, words: list<array{word: string, start: float, end: float}>}>|null
     */
    private function scriptCaptions(string $script, array $result, float $duration, CaptionRefinerInterface $refiner, UsageService $usage, User $user, Project $project): ?array
    {
        $speech = collect($result['segments'])
            ->flatMap(fn ($seg) => $seg['words'] ?? [])
            ->filter(fn ($w) => isset($w['start'], $w['end']) && trim((string) ($w['word'] ?? $w['text'] ?? '')) !== '')
            ->map(fn ($w) => ['word' => (string) ($w['word'] ?? $w['text']), 'start' => (float) $w['start'], 'end' => (float) $w['end']])
            ->sortBy('start')->values()->all();
        if ($speech === []) {
            AppLog::warning('pipeline.script_skipped', ['project' => $project->uuid, 'reason' => 'no speech timings']);

            return null; // nothing to align to: fall back to the AI captions
        }

        $text = app(EnglishWords::class)->apply(app(SinhalaScriptRepair::class)->repair($script));
        $paragraphs = preg_split('/(?<=[.!?\n])\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $english = $refiner->refine(array_map(fn ($p) => ['text' => $p, 'language' => $result['language']], $paragraphs), $result['language']);
        if ($refiner->model()) {
            $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => 'gemini-cleanup', 'model' => $refiner->model(), 'purpose' => 'script']);
        }
        $aligned = app(ScriptAligner::class)->align(implode(' ', $english), $speech, $duration, $result['language']);
        AppLog::info('pipeline.script_aligned', ['project' => $project->uuid] + $aligned['stats']);

        $lines = [];
        foreach ($aligned['segments'] as $seg) {
            $clean = ScriptAligner::stripPunctuation($seg['text']);
            if ($clean === '') {
                continue;
            }
            $words = [];
            foreach ($seg['words'] as $w) {
                $word = ScriptAligner::stripPunctuation($w['word']);
                if ($word !== '') {
                    $words[] = ['word' => $word, 'start' => (float) $w['start'], 'end' => (float) $w['end']];
                }
            }
            $lines[] = ['start' => (float) $seg['start'], 'end' => (float) $seg['end'], 'text' => $clean, 'original' => $seg['text'], 'language' => $seg['language'], 'words' => $words];
        }

        return $lines ?: null;
    }

    /**
     * Stores captions. The transcript row keeps the ORIGINAL transcription (text, segments,
     * word timestamps) untouched; each caption keeps `metadata.original_text` so users can
     * always compare with or restore what the AI heard.
     *
     * @param  list<string>  $cleaned  text-model clean-up, 1:1 with segments
     */
    /**
     * Final OpenAI pass over the finished caption lines (not over the user's own script):
     * corrected lines get their word timings re-aligned; every other line is left as it was.
     *
     * @return array{0: array, 1: list<string>, 2: array|null}
     */
    private function correctCaptions(CaptionRefinerInterface $corrector, array $result, array $cleaned, ?array $lines, UsageService $usage, User $user, Project $project): array
    {
        $aligner = app(ScriptAligner::class);
        $texts = $lines !== null ? array_column($lines, 'text') : $cleaned;
        if ($texts === []) {
            return [$result, $cleaned, $lines];
        }
        $corrected = $corrector->refine(array_map(fn ($t) => ['text' => (string) $t, 'language' => $result['language']], $texts), $result['language']);
        if (! $corrector->model()) {
            return [$result, $cleaned, $lines]; // nothing was called successfully (no credits, busy …)
        }
        $usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => 'openai-correction', 'model' => $corrector->model()]);

        $changed = 0;
        foreach ($texts as $i => $before) {
            $after = trim((string) ($corrected[$i] ?? ''));
            if ($after === '' || $after === $before) {
                continue;
            }
            $changed++;
            if ($lines !== null) {
                $line = $lines[$i];
                $lines[$i] = ['text' => $after, 'words' => $aligner->alignWords($after, $line['words'] ?? [], (float) $line['start'], (float) $line['end'])]
                    + ['meta' => ($line['meta'] ?? []) + ['corrected_by' => $corrector->model()]] + $line;
            } else {
                $seg = &$result['segments'][$i];
                $seg['reviewed_words'] = $aligner->alignWords($after, $seg['reviewed_words'] ?? $seg['words'] ?? [], (float) $seg['start'], (float) $seg['end']);
                $seg['reviewed_text'] = $after;
                unset($seg);
                $cleaned[$i] = $after;
            }
        }
        AppLog::info('pipeline.openai_corrected', ['project' => $project->uuid, 'lines' => count($texts), 'changed' => $changed, 'model' => $corrector->model()]);

        return [$result, $cleaned, $lines];
    }

    private function storeCaptions(Project $project, MediaFile $media, array $result, array $cleaned, string $transcriber, ?string $cleanupModel, ?array $scriptLines = null): int
    {
        return DB::transaction(function () use ($project, $media, $result, $cleaned, $transcriber, $cleanupModel, $scriptLines) {
            $transcript = Transcript::updateOrCreate(
                ['project_id' => $project->id],
                [
                    'uuid' => Transcript::where('project_id', $project->id)->value('uuid') ?? (string) Str::uuid(),
                    'media_file_id' => $media->id,
                    'language' => $result['language'],
                    'raw_text' => $result['text'],
                    'words_json' => array_map(fn ($seg) => array_diff_key($seg, ['reviewed_text' => 1, 'reviewed_words' => 1]), $result['segments']),
                    'status' => 'completed',
                    'confidence' => null,
                ],
            );

            // Regeneration replaces captions; force-delete so stale soft-deleted rows don't pile up.
            Caption::withTrashed()->where('project_id', $project->id)->forceDelete();

            $now = now();
            $rows = [];
            foreach ($scriptLines ?? [] as $i => $line) {
                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'project_id' => $project->id,
                    'transcript_id' => $transcript->id,
                    'sequence' => $i + 1,
                    'start_time' => $line['start'],
                    'end_time' => $line['end'],
                    'text' => $line['text'],
                    'language' => $line['language'],
                    'metadata' => json_encode([
                        'words' => $line['words'],
                        'original_text' => $line['original'],
                        'source' => $line['source'] ?? ['imported' => 'script', 'transcriber' => $transcriber],
                    ] + ($line['meta'] ?? []), JSON_UNESCAPED_UNICODE),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            foreach ($scriptLines === null ? $result['segments'] : [] as $i => $seg) {
                $text = $cleaned[$i] ?? $seg['text'];
                $words = $seg['reviewed_words'] ?? $seg['words'] ?? [];
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
                    'original_text' => $seg['transcribed_text'] ?? $seg['text'],
                    'cleaned' => $text !== $seg['text'],
                    'reviewed' => isset($seg['reviewed_text']) ? true : null,
                    'script_repaired' => isset($seg['transcribed_text']) && $seg['transcribed_text'] !== $seg['text'] ? true : null,
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
        Cache::forget(self::progressKey($project));
        $project->update(['status' => Project::STATUS_FAILED, 'processing_error' => mb_substr($message, 0, 500)]);
    }
}
