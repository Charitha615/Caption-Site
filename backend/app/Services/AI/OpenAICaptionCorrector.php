<?php

namespace App\Services\AI;

use App\Support\AppLog;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Final text-correction pass over generated captions with OpenAI (OPENAI_MODEL).
 *
 * Runs after Gemini transcription/review: fixes Sinhala spelling and writes English words
 * that were spelled phonetically in Sinhala letters in English letters ("ටොයොටා ඇක්වා" →
 * "Toyota Aqua"). Text only — lines stay 1:1 and timing is untouched.
 *
 * Best effort, like the Gemini refiner: any failure (no credits, timeout, bad answer) or an
 * edit that looks like a translation/rewrite leaves that line exactly as it was.
 */
class OpenAICaptionCorrector implements CaptionRefinerInterface
{
    private const BATCH = 120;

    private ?string $usedModel = null;

    public function __construct(
        protected string $apiKey,
        protected ?string $textModel = null,
        protected ?string $baseUrl = null,
    ) {
        $this->textModel ??= (string) config('ai.openai.model');
        $this->baseUrl = rtrim($this->baseUrl ?? (string) config('ai.openai.base_url'), '/');
    }

    public function model(): ?string
    {
        return $this->usedModel;
    }

    public function refine(array $lines, string $language, ?string $audioPath = null): array
    {
        $result = array_column($lines, 'text');
        foreach (array_chunk($result, self::BATCH, true) as $batch) {
            $corrected = $this->correctBatch(array_values($batch), $language);
            if ($corrected === null) {
                continue;
            }
            foreach (array_keys($batch) as $n => $index) {
                if (GeminiCaptionRefiner::acceptable($result[$index], $corrected[$n])) {
                    $result[$index] = $corrected[$n];
                }
            }
        }

        return $result;
    }

    /**
     * @param  list<string>  $texts
     * @return list<string>|null
     */
    protected function correctBatch(array $texts, string $language): ?array
    {
        $langNote = match ($language) {
            'si' => 'The captions are Sinhala (සිංහල) speech, often with English words mixed in.',
            'en' => 'The captions are English speech.',
            default => 'The captions may be Sinhala, English, or a mix of both.',
        };
        $system = <<<PROMPT
You correct machine-generated video captions. {$langNote}
For each line:
- Fix Sinhala spelling to standard dictionary spelling (ණ/න, ළ/ල, ශ/ෂ/ස, vowel signs) and repair broken conjuncts with ZWJ (ශ්‍රී, ප්‍ර, ත්‍ර, ක්‍ය).
- English words spoken inside Sinhala are often spelled phonetically in Sinhala letters. Write them in English letters, including brands, models and technical terms: "ටොයොටා ඇක්වා" → "Toyota Aqua", "හයිබ්‍රිඩ්" → "hybrid", "ෆියුල්" → "fuel", "චැනල් එක සබ්ස්ක්‍රයිබ් කරන්න" → "channel එක subscribe කරන්න". Keep Sinhala grammar suffixes in Sinhala (එක, එකේ, කරන්න).
- Fix obvious typos and spacing in English words.
Never translate real Sinhala words to English or English to Sinhala. Do not add, remove, reorder, merge or split words or lines. Do not add punctuation the line did not have. If a line is already correct, return it unchanged.
Return {"lines": [...]} with exactly one string per input line, in the same order.
PROMPT;

        try {
            $response = Http::acceptJson()
                ->withToken($this->apiKey)
                ->timeout((int) config('ai.openai.timeout', 60))
                ->retry(2, fn (int $attempt) => $attempt * 2000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [500, 502, 503], true), throw: false)
                ->post("{$this->baseUrl}/chat/completions", array_filter([
                    'model' => $this->textModel,
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => json_encode($texts, JSON_UNESCAPED_UNICODE)],
                    ],
                    'reasoning_effort' => config('ai.openai.reasoning_effort') ?: null,
                    'response_format' => [
                        'type' => 'json_schema',
                        'json_schema' => [
                            'name' => 'caption_lines',
                            'strict' => true,
                            'schema' => [
                                'type' => 'object',
                                'properties' => ['lines' => ['type' => 'array', 'items' => ['type' => 'string']]],
                                'required' => ['lines'],
                                'additionalProperties' => false,
                            ],
                        ],
                    ],
                ]));
        } catch (\Throwable $e) {
            AppLog::warning('ai.openai_correction_failed', ['model' => $this->textModel, 'error' => $e->getMessage()]);

            return null;
        }

        if (! $response->successful()) {
            AppLog::warning('ai.openai_correction_failed', [
                'model' => $this->textModel,
                'status' => $response->status(),
                'provider_error' => $response->json('error.code') ?? $response->json('error.message'),
            ]);

            return null;
        }

        $lines = json_decode((string) $response->json('choices.0.message.content'), true)['lines'] ?? null;
        if (! is_array($lines) || count($lines) !== count($texts)) {
            AppLog::warning('ai.openai_correction_mismatch', ['model' => $this->textModel, 'expected' => count($texts), 'got' => is_array($lines) ? count($lines) : null]);

            return null;
        }
        $this->usedModel = $this->textModel;

        return array_map(fn ($l) => is_string($l) ? (normalizer_normalize(trim($l)) ?: trim($l)) : '', $lines);
    }
}
