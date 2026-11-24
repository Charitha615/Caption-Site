<?php

namespace App\Services\AI;

use App\Support\AppLog;
use App\Support\AudioMime;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Caption clean-up with the text model (Gemini 3.8 Flash by default).
 *
 * Best effort and conservative: it fixes punctuation, spacing, capitalisation and broken
 * Sinhala Unicode, keeps every line 1:1, and never translates or rewrites meaning. Any
 * failure, a mismatched line count, or a suspiciously large change leaves the original
 * line untouched — cleanup can never fail the pipeline or lose transcribed words.
 */
class GeminiCaptionRefiner implements CaptionRefinerInterface
{
    private const BATCH = 150;

    private ?string $usedModel = null;

    public function __construct(
        protected string $apiKey,
        protected ?string $textModel = null,
        protected ?string $baseUrl = null,
    ) {
        $this->textModel ??= (string) config('ai.gemini.model');
        $this->baseUrl ??= rtrim((string) config('ai.gemini.base_url'), '/');
    }

    public function model(): ?string
    {
        return $this->usedModel;
    }

    public function refine(array $lines, string $language, ?string $audioPath = null): array
    {
        $original = array_column($lines, 'text');
        $result = $original;
        $audio = $this->audioPart($audioPath);

        foreach (array_chunk($lines, self::BATCH, true) as $batch) {
            $listened = false;
            $cleaned = null;
            if ($audio) {
                $cleaned = $this->reviewBatch(array_values($batch), $language, $audio);
                $listened = $cleaned !== null;
            }
            // No audio, or every model was too busy to listen: the lighter text-only pass still
            // fixes spelling and writes English words in English letters.
            $cleaned ??= $this->refineBatch(array_column(array_values($batch), 'text'), $language);
            if ($cleaned === null) {
                continue;
            }
            foreach (array_keys($batch) as $n => $index) {
                $ok = $listened ? self::reviewAcceptable($original[$index], $cleaned[$n] ?? null) : self::acceptable($original[$index], $cleaned[$n] ?? null);
                if ($ok) {
                    $result[$index] = $cleaned[$n];
                }
            }
        }

        return $result;
    }

    /** Inline audio for the review, or null when there is none or it is too large to send inline. */
    protected function audioPart(?string $audioPath): ?array
    {
        if ($audioPath === null || ! is_file($audioPath)) {
            return null;
        }
        $size = (int) filesize($audioPath);
        if ($size === 0 || $size > (int) config('ai.gemini.review_max_bytes', 8 * 1024 * 1024)) {
            return null;
        }

        return ['inline_data' => ['mime_type' => AudioMime::of($audioPath), 'data' => base64_encode((string) file_get_contents($audioPath))]];
    }

    /**
     * Listening review: the model hears the audio and corrects each line against it —
     * misheard Sinhala words, English words written in Sinhala letters, and words the
     * transcriber missed. Lines stay 1:1; timing is re-derived afterwards.
     *
     * @param  list<array{text: string, start?: float, end?: float}>  $lines
     * @return list<string>|null
     */
    protected function reviewBatch(array $lines, string $language, array $audio): ?array
    {
        $langNote = match ($language) {
            'si' => 'The speech is Sinhala (සිංහල), often with English words mixed in.',
            'en' => 'The speech is English.',
            default => 'The speech may be Sinhala, English, or a mix of both.',
        };
        $input = array_map(fn ($l) => [
            'time' => isset($l['start'], $l['end']) ? sprintf('%.1f-%.1f', $l['start'], $l['end']) : null,
            'text' => $l['text'],
        ], $lines);
        $prompt = <<<PROMPT
You are reviewing machine-generated captions against the audio attached. {$langNote}
Listen carefully to the audio. Each caption line has its time range in seconds from the start of this audio.
For each line, write exactly what is SAID in that time range:
- Fix words that were misheard or misspelled. Sinhala must be correct, standard Sinhala Unicode spelling (ණ/න, ළ/ල, ශ/ෂ/ස, vowel signs, ZWJ conjuncts like ශ්‍රී, ප්‍ර, ත්‍ර, ක්‍ය).
- Words spoken in English (including brand and model names, technical terms) must be written in English letters, e.g. "Toyota Aqua", "hybrid", "fuel", "system", "bike showroom" — never in Sinhala letters.
- Add words that were spoken in that time range but are missing from the line (especially at the very start of the audio and short English words).
- Remove words that were not spoken.
Do not translate. Do not summarise. Do not move words to other lines. Keep the same number of lines in the same order. Punctuation: only what the speech needs.
Return a JSON object {"lines": [...]} with exactly one string per input line.
Caption lines (JSON):
PROMPT;
        $prompt .= json_encode($input, JSON_UNESCAPED_UNICODE);

        return $this->ask([$audio, ['text' => $prompt]], count($lines), (int) config('ai.gemini.review_timeout', 90), 'ai.review_failed');
    }

    /**
     * Sends the request to the text model; when it is busy (429/5xx/timeout) after a few
     * spaced retries, tries the fallback models (GEMINI_FALLBACK_MODELS) before giving up.
     *
     * @return list<string>|null
     */
    protected function ask(array $parts, int $expected, int $timeout, string $failEvent): ?array
    {
        $models = array_values(array_unique([$this->textModel, ...(array) config('ai.gemini.fallback_models', [])]));
        foreach ($models as $model) {
            try {
                $response = Http::acceptJson()
                    ->withHeaders(['x-goog-api-key' => $this->apiKey])
                    ->timeout($timeout)
                    ->retry(2, fn (int $attempt) => $attempt * 3000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                    ->post("{$this->baseUrl}/models/{$model}:generateContent", [
                        'contents' => [['role' => 'user', 'parts' => $parts]],
                        'generationConfig' => [
                            'temperature' => 0,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => ['type' => 'OBJECT', 'properties' => ['lines' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']]], 'required' => ['lines']],
                            ...(preg_match('/gemini-(\d+)/', $model, $m) && (int) $m[1] >= 3 ? ['thinkingConfig' => ['thinkingLevel' => 'low']] : []),
                        ],
                    ]);
            } catch (\Throwable $e) {
                AppLog::warning($failEvent, ['model' => $model, 'error' => $e->getMessage()]);

                continue; // timeout / connection: try the next model
            }
            if (! $response->successful()) {
                AppLog::warning($failEvent, ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);

                continue; // busy, or this model is not available to the key: try the next one
            }

            return $this->lines($response, $expected, $model);
        }

        return null;
    }

    /**
     * Guard for the listening review: words may be added, fixed or removed (it heard the
     * audio), but a line must not vanish, balloon, or be translated wholesale.
     */
    public static function reviewAcceptable(string $original, ?string $reviewed): bool
    {
        if ($reviewed === null || trim($reviewed) === '') {
            return false;
        }
        $words = fn (string $t) => preg_split('/\s+/u', trim($t), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $wa = count($words($original));
        $wb = count($words($reviewed));
        if ($wb > $wa * 2 + 4 || $wb < $wa * 0.4) {
            return false;
        }
        $sinhala = fn (string $t) => count(array_filter($words($t), fn ($w) => preg_match('/[\x{0D80}-\x{0DFF}]/u', $w)));
        $sa = $sinhala($original);
        $sb = $sinhala($reviewed);

        // A mostly-Sinhala line turning (almost) all English is translation, not correction.
        return ! ($sa >= 3 && $sb < $sa * 0.34);
    }

    /** @return list<string>|null */
    protected function refineBatch(array $texts, string $language): ?array
    {
        $langNote = match ($language) {
            'si' => 'The captions are Sinhala (සිංහල), possibly with English words.',
            'en' => 'The captions are English.',
            default => 'The captions may be Sinhala, English, or a mix of both.',
        };
        $prompt = <<<PROMPT
You clean up machine-transcribed video captions. {$langNote}
For each line: fix punctuation, spacing and capitalisation, and repair broken Sinhala Unicode (e.g. ZWJ conjuncts like ශ්‍රී, ප්‍ර, ත්‍ර).
Correct Sinhala spelling mistakes thoroughly (standard dictionary spelling, correct ණ/න, ළ/ල, ශ/ෂ/ස, and vowels).
English words spoken inside Sinhala speech are often written phonetically in Sinhala letters — write those in English (Latin) letters: e.g. "බයික් ෂෝරූම්" → "bike showroom", "ෆියුල්" → "fuel", "සිස්ටම්" → "system", "මාකට් ස්ට්‍රැටජි" → "market strategy". Brand and model names too (e.g. "යමහා" → "Yamaha", "ටොයොටා ඇක්වා" → "Toyota Aqua", "හයිබ්‍රිඩ්" → "Hybrid").
Rules: keep the SAME words, word order and meaning; never translate Sinhala words into English or English into Sinhala; do not add, remove, merge or split lines; if a line is already fine, return it unchanged.
Return a JSON object {"lines": [...]} with exactly one string per input line, in order.
Input lines (JSON): 
PROMPT;
        $prompt .= json_encode($texts, JSON_UNESCAPED_UNICODE);

        return $this->ask([['text' => $prompt]], count($texts), (int) config('ai.gemini.cleanup_timeout', 45), 'ai.cleanup_failed');
    }

    /** @return list<string>|null */
    protected function lines(Response $response, int $expected, ?string $model = null): ?array
    {
        if (! $response->successful()) {
            AppLog::warning('ai.cleanup_failed', ['model' => $model ?? $this->textModel, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);

            return null;
        }
        $text = collect($response->json('candidates.0.content.parts') ?? [])->pluck('text')->filter()->implode('');
        $lines = json_decode($text, true)['lines'] ?? null;
        if (! is_array($lines) || count($lines) !== $expected) {
            AppLog::warning('ai.cleanup_mismatch', ['model' => $model ?? $this->textModel, 'expected' => $expected, 'got' => is_array($lines) ? count($lines) : null]);

            return null;
        }
        $this->usedModel = $model ?? $this->textModel;

        return array_map(fn ($l) => is_string($l) ? normalizer_normalize(trim($l)) ?: trim($l) : '', $lines);
    }

    /**
     * Rejects edits that look like rewrites or translations rather than clean-up.
     * Allowed: punctuation, spacing, Unicode repair, and English loanwords moving from
     * Sinhala letters to Latin letters. Not allowed: dropping/adding words, English→Sinhala,
     * or a mostly-Sinhala line turning into English (translation).
     */
    public static function acceptable(string $original, ?string $cleaned): bool
    {
        if ($cleaned === null || trim($cleaned) === '') {
            return false;
        }
        $words = fn (string $t) => preg_split('/\s+/u', trim($t), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $wa = count($words($original));
        $wb = count($words($cleaned));
        if (abs($wa - $wb) > max(1, (int) ceil($wa * 0.25))) {
            return false; // words added or removed
        }
        $a = mb_strlen($original);
        $b = mb_strlen($cleaned);
        if ($a > 0 && ($b < $a * 0.5 || $b > $a * 1.6 + 4)) {
            return false;
        }
        $sinhalaWords = fn (string $t) => count(array_filter($words($t), fn ($w) => preg_match('/[\x{0D80}-\x{0DFF}]/u', $w)));
        $sa = $sinhalaWords($original);
        $sb = $sinhalaWords($cleaned);
        if ($sa === 0 && $sb > 0) {
            return false; // English turned into Sinhala
        }

        // Loanwords may move to Latin script, but Sinhala must not vanish (that is translation).
        if ($sa >= 2 && $sb === 0) {
            return false;
        }

        return ! ($sa >= 3 && $sb < $sa * 0.5);
    }
}
