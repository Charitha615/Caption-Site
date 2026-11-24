<?php

namespace App\Services\AI;

use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use App\Services\Caption\EnglishWords;
use App\Services\Caption\ScriptAligner;
use App\Services\Caption\SinhalaScriptRepair;
use App\Services\Usage\UsageService;
use App\Support\AppLog;

/**
 * Captions for one short audio part (about 30 s), shared by the upload pipeline and the video editor:
 *
 * 1. transcribe it, 2. repair wrong-script Sinhala, 3. mixed-script words from the prompted Flash
 * model lined up with the heard timings — or, when that isn't available, have the text model LISTEN
 * to the part and correct its lines, 4. English words spoken in Sinhala speech → English letters.
 *
 * Every AI request is checked against and recorded in the user's usage. Times stay part-relative.
 */
class SpeechPartTranscriber
{
    public function __construct(
        private UsageService $usage,
        private SinhalaScriptRepair $repair,
        private ScriptAligner $aligner,
        private EnglishWords $english,
    ) {}

    /**
     * @param  array{path: string, duration: float, offset?: float}  $part
     * @param  array{repaired: int, reviewed: int, english: int, mixed: int, mixed_rejected: int}  $stats  updated in place
     * @return array{
     *     result: array{text: string, language: string, segments: list<array<string, mixed>>, usage: array<string, mixed>},
     *     segments: list<array<string, mixed>>,
     *     lines: list<array{start: float, end: float, text: string, original: string, language: string, words: list<array{word: string, start: float, end: float}>, source: array<string, mixed>, meta: array<string, mixed>}>,
     *     mixed: bool
     * }
     */
    public function transcribe(
        AIProviderInterface $ai,
        CaptionRefinerInterface $refiner,
        ?GeminiMixedTranscriber $mixed,
        User $user,
        ?Project $project,
        array $part,
        string $language,
        int $partNumber,
        string $vocabulary = '',
        bool $review = true,
        array &$stats = [],
    ): array {
        $stats += ['repaired' => 0, 'reviewed' => 0, 'english' => 0, 'mixed' => 0, 'mixed_rejected' => 0];
        $listen = (bool) config('ai.gemini.caption_review', true);

        $this->usage->ensureCanRequestAI($user);
        $result = $ai->transcribe($part['path'], $language, ['duration' => $part['duration']]);
        $this->usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $ai->name(), 'part' => $partNumber] + (isset($part['offset']) ? ['offset' => $part['offset']] : []) + $result['usage']);

        $segments = array_map(fn ($seg) => $seg + ['transcribed_text' => $seg['text']], $result['segments']);
        [$segments, $repaired] = $this->repair->repairSegments($segments);
        $stats['repaired'] += $repaired;

        $flashLines = $mixed ? $this->mixedLines($mixed, $part, $segments, $result['language'], $user, $project, $vocabulary, $partNumber, $stats) : null;

        if ($flashLines === null && $segments !== [] && $review) {
            $reviewed = $refiner->refine($segments, $result['language'], $listen ? $part['path'] : null);
            if ($refiner->model()) {
                $this->usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => $listen ? 'gemini-review' : 'gemini-cleanup', 'model' => $refiner->model(), 'part' => $partNumber]);
            }
            foreach ($segments as $i => &$seg) {
                $text = trim((string) ($reviewed[$i] ?? $seg['text']));
                if ($text !== '' && $text !== $seg['text']) {
                    $seg['reviewed_text'] = $text;
                    $seg['reviewed_words'] = $this->aligner->alignWords($text, $seg['words'] ?? [], (float) $seg['start'], (float) $seg['end']);
                    $stats['reviewed']++;
                }
            }
            unset($seg);
        }

        // English words spoken in Sinhala speech → English letters (built-in list, always runs,
        // so it still works when the AI review was busy or missed some).
        foreach ($segments as &$seg) {
            $line = $this->english->applyToLine($seg['reviewed_text'] ?? $seg['text'], $seg['reviewed_words'] ?? $seg['words'] ?? []);
            if ($line['changed']) {
                $seg['reviewed_text'] = $line['text'];
                $seg['reviewed_words'] = $line['words'];
                $stats['english']++;
            }
        }
        unset($seg);

        $lines = $flashLines ?? array_map(fn ($seg) => [
            'start' => (float) $seg['start'],
            'end' => (float) $seg['end'],
            'text' => $seg['reviewed_text'] ?? $seg['text'],
            'original' => $seg['transcribed_text'] ?? $seg['text'],
            'language' => $seg['language'],
            'words' => array_map(fn ($w) => ['word' => (string) ($w['word'] ?? $w['text'] ?? ''), 'start' => (float) $w['start'], 'end' => (float) $w['end']], $seg['reviewed_words'] ?? $seg['words'] ?? []),
            'source' => ['transcriber' => $ai->name()],
            'meta' => array_filter(['reviewed' => isset($seg['reviewed_text']) ? true : null, 'speaker' => $seg['speaker'] ?? null]),
        ], $segments);

        return ['result' => $result, 'segments' => $segments, 'lines' => $lines, 'mixed' => $flashLines !== null];
    }

    /**
     * One part with the prompted Flash model: its mixed-script words, repaired and with the
     * English word list applied, lined up with the words the transcribe model heard (exact
     * timings; words it missed are placed in the gaps). Null → use the transcription instead.
     *
     * @return list<array<string, mixed>>|null caption lines, part-relative times
     */
    private function mixedLines(GeminiMixedTranscriber $mixed, array $part, array $segments, string $language, User $user, ?Project $project, string $vocabulary, int $partNumber, array &$stats): ?array
    {
        $speech = collect($segments)
            ->flatMap(fn ($seg) => $seg['words'] ?? [])
            ->filter(fn ($w) => isset($w['start'], $w['end']) && trim((string) ($w['word'] ?? $w['text'] ?? '')) !== '')
            ->map(fn ($w) => ['word' => (string) ($w['word'] ?? $w['text']), 'start' => (float) $w['start'], 'end' => (float) $w['end']])
            ->sortBy('start')->values()->all();

        $this->usage->ensureCanRequestAI($user);
        $text = $mixed->transcribe($part['path'], $language, $vocabulary);
        if ($mixed->model()) {
            $this->usage->record($user, UsageRecord::ACTION_AI_REQUEST, 1, 'requests', $project, ['provider' => 'gemini-mixed', 'model' => $mixed->model(), 'part' => $partNumber]);
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
            AppLog::warning('pipeline.mixed_rejected', ['project' => $project?->uuid, 'part' => $partNumber, 'heard_words' => count($speech), 'flash_words' => count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [])]);

            return null;
        }

        $text = $this->english->apply($this->repair->repair($text));
        $aligned = $this->aligner->align($text, $speech, (float) $part['duration'], $language);
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
}
