<?php

namespace App\Services\AI;

use App\Support\AppLog;
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

    public function refine(array $lines, string $language): array
    {
        $original = array_column($lines, 'text');
        $result = $original;

        foreach (array_chunk($original, self::BATCH, true) as $batch) {
            $cleaned = $this->refineBatch(array_values($batch), $language);
            if ($cleaned === null) {
                continue;
            }
            foreach (array_keys($batch) as $n => $index) {
                if (self::acceptable($original[$index], $cleaned[$n] ?? null)) {
                    $result[$index] = $cleaned[$n];
                }
            }
        }

        return $result;
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
For each line: fix punctuation, spacing and capitalisation, and repair broken Sinhala Unicode (e.g. ZWJ conjuncts like ශ්‍රී).
English words spoken inside Sinhala speech are often written phonetically in Sinhala letters — write those in English (Latin) letters: e.g. "බයික් ෂෝරූම්" → "bike showroom", "ෆියුල්" → "fuel", "සිස්ටම්" → "system", "මාකට් ස්ට්‍රැටජි" → "market strategy". Brand and model names too (e.g. "යමහා" → "Yamaha").
Rules: keep the SAME words, word order and meaning; never translate Sinhala words into English or English into Sinhala; do not add, remove, merge or split lines; if a line is already fine, return it unchanged.
Return a JSON object {"lines": [...]} with exactly one string per input line, in order.
Input lines (JSON): 
PROMPT;
        $prompt .= json_encode($texts, JSON_UNESCAPED_UNICODE);

        try {
            $response = Http::acceptJson()
                ->withHeaders(['x-goog-api-key' => $this->apiKey])
                ->timeout((int) config('ai.gemini.cleanup_timeout', 45))
                ->retry(2, 3000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                ->post("{$this->baseUrl}/models/{$this->textModel}:generateContent", [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'temperature' => 0,
                        'responseMimeType' => 'application/json',
                        'responseSchema' => ['type' => 'OBJECT', 'properties' => ['lines' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']]], 'required' => ['lines']],
                        ...(preg_match('/gemini-(\d+)/', $this->textModel, $m) && (int) $m[1] >= 3 ? ['thinkingConfig' => ['thinkingLevel' => 'low']] : []),
                    ],
                ]);
        } catch (\Throwable $e) {
            AppLog::warning('ai.cleanup_failed', ['model' => $this->textModel, 'error' => $e->getMessage()]);

            return null;
        }

        return $this->lines($response, count($texts));
    }

    /** @return list<string>|null */
    protected function lines(Response $response, int $expected): ?array
    {
        if (! $response->successful()) {
            AppLog::warning('ai.cleanup_failed', ['model' => $this->textModel, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);

            return null;
        }
        $text = collect($response->json('candidates.0.content.parts') ?? [])->pluck('text')->filter()->implode('');
        $lines = json_decode($text, true)['lines'] ?? null;
        if (! is_array($lines) || count($lines) !== $expected) {
            AppLog::warning('ai.cleanup_mismatch', ['model' => $this->textModel, 'expected' => $expected, 'got' => is_array($lines) ? count($lines) : null]);

            return null;
        }
        $this->usedModel = $this->textModel;

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
