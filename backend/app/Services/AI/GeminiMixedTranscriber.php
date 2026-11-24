<?php

namespace App\Services\AI;

use App\Support\AppLog;
use App\Support\AudioMime;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Writes the words of a short speech clip with a prompted Gemini Flash model, keeping every
 * word in the script of the language it was spoken in ("මට Door එක අරගන්න ඕන").
 *
 * The dedicated transcribe model takes no instructions, so it often writes English words
 * in Sinhala letters. A prompted model can be told not to. Timing is NOT taken from here:
 * the pipeline lines these words up with the transcribe model's word timestamps.
 */
class GeminiMixedTranscriber
{
    private ?string $usedModel = null;

    public function __construct(
        protected string $apiKey,
        protected ?string $baseUrl = null,
    ) {
        $this->baseUrl ??= rtrim((string) config('ai.gemini.base_url'), '/');
    }

    public function model(): ?string
    {
        return $this->usedModel;
    }

    /** Models to try in order: the mixed-script models, then the text model and its fallbacks. */
    public function models(): array
    {
        return array_values(array_unique(array_filter([
            ...(array) config('ai.gemini.mixed_models', []),
            (string) config('ai.gemini.model'),
            ...(array) config('ai.gemini.fallback_models', []),
        ])));
    }

    public static function prompt(string $language, string $vocabulary = ''): string
    {
        $prompt = "Transcribe the speech in this audio clip exactly as spoken. Do not translate.\n"
            .'Write every word in the script of the language it was spoken in: when a speaker mixes languages, keep each word in its own script. '
            ."For example, Sinhala mixed with English is written as: මට Door එක අරගන්න ඕන\n"
            .'English words, brand names, model names and technical terms spoken inside Sinhala are written in English letters (e.g. Toyota Aqua, hybrid, traffic, second hand). '
            ."Sinhala words use correct standard Sinhala Unicode spelling. Numbers may be written as digits.\n"
            .'Output only the transcript text on a single line, with no labels, quotes, timestamps or notes. If there is no speech, output nothing.';
        $main = ['si' => 'Sinhala (si)', 'en' => 'English (en)'][$language] ?? null;
        if ($main) {
            $prompt .= "\nThe main spoken language is {$main}.";
        }
        $vocabulary = trim(preg_replace('/\s+/u', ' ', $vocabulary) ?? '');
        if ($vocabulary !== '') {
            $prompt .= "\nVocabulary and context (use these spellings): ".mb_substr($vocabulary, 0, 1000);
        }

        return $prompt;
    }

    /**
     * @return string|null the transcript ('' = no speech), or null when every model failed
     */
    public function transcribe(string $audioPath, string $language, string $vocabulary = ''): ?string
    {
        $size = is_file($audioPath) ? (int) filesize($audioPath) : 0;
        if ($size === 0 || $size > (int) config('ai.gemini.review_max_bytes', 8 * 1024 * 1024)) {
            return null;
        }
        $parts = [
            ['inline_data' => ['mime_type' => AudioMime::of($audioPath), 'data' => base64_encode((string) file_get_contents($audioPath))]],
            ['text' => self::prompt($language, $vocabulary)],
        ];

        foreach ($this->models() as $model) {
            try {
                $response = Http::acceptJson()
                    ->withHeaders(['x-goog-api-key' => $this->apiKey])
                    ->timeout((int) config('ai.gemini.mixed_timeout', 60))
                    ->retry(3, fn (int $attempt) => 1000 * (2 ** $attempt), fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 502, 503, 504], true), throw: false)
                    ->post("{$this->baseUrl}/models/{$model}:generateContent", [
                        'contents' => [['role' => 'user', 'parts' => $parts]],
                        'generationConfig' => [
                            'temperature' => 0,
                            ...(preg_match('/gemini-(\d+)/', $model, $m) && (int) $m[1] >= 3 ? ['thinkingConfig' => ['thinkingLevel' => 'low']] : []),
                        ],
                    ]);
            } catch (\Throwable $e) {
                AppLog::warning('ai.mixed_transcribe_failed', ['model' => $model, 'error' => $e->getMessage()]);

                continue;
            }
            if (! $response->successful()) {
                AppLog::warning('ai.mixed_transcribe_failed', ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);

                continue; // busy, or not available to this key: next model
            }
            $this->usedModel = $model;

            return self::clean(collect($response->json('candidates.0.content.parts') ?? [])
                ->reject(fn ($p) => $p['thought'] ?? false)
                ->pluck('text')->filter()->implode(' '));
        }

        return null;
    }

    /** One line of plain transcript: no wrapping quotes, labels or extra whitespace. */
    public static function clean(string $text): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        $text = preg_replace('/^(transcript|transcription)\s*:\s*/iu', '', $text) ?? $text;
        $text = trim($text, " \"'“”");

        return \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
    }

    /**
     * Sanity check against what the timing model heard: far fewer words means speech was
     * dropped; more words than anyone can say in the clip means hallucination. More words
     * than the timing model heard is fine (it often skips words — those are recovered).
     */
    public static function plausible(string $text, int $heardWords, float $seconds): bool
    {
        $words = count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return $words >= $heardWords * 0.5 && $words <= max($heardWords * 2.5 + 8, $seconds * 4.5);
    }
}
