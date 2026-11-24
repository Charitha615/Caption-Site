<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/** Writing help with the Gemini text model (and its fallbacks when it is busy). */
class GeminiTextAssistant implements TextAssistantInterface
{
    public const LANGUAGES = ['si' => 'Sinhala (සිංහල, Sinhala script)', 'en' => 'English', 'ta' => 'Tamil (தமிழ், Tamil script)'];

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

    public function singlishToSinhala(array $lines): array
    {
        $prompt = "Convert Singlish (Sinhala written phonetically in English letters, e.g. \"kohomada oyata\") into correct Sinhala script (\"කොහොමද ඔයාට\").\n"
            ."Use standard Sinhala spelling. Words that are really English (brand names, \"phone\", \"video\") stay in English letters. Lines already in Sinhala script stay as they are.\n"
            ."Do not translate, add or remove words, and do not merge or split lines.\n"
            .'Return {"lines": [...]} with exactly one string per input line, in order. Input lines (JSON): '
            .json_encode(array_values($lines), JSON_UNESCAPED_UNICODE);

        return $this->lines($prompt, count($lines));
    }

    public function translate(array $lines, string $to): array
    {
        $target = self::LANGUAGES[$to] ?? self::LANGUAGES['en'];
        $prompt = "Translate these video subtitle lines into {$target}. Keep them short and natural for subtitles, keep names as they are, and keep the meaning.\n"
            ."Translate each line on its own; do not merge or split lines.\n"
            .'Return {"lines": [...]} with exactly one string per input line, in order. Input lines (JSON): '
            .json_encode(array_values($lines), JSON_UNESCAPED_UNICODE);

        return $this->lines($prompt, count($lines));
    }

    public function script(string $topic, string $language, int $seconds, string $tone): array
    {
        $target = self::LANGUAGES[$language] ?? self::LANGUAGES['en'];
        $words = max(20, (int) round($seconds * 2.3));
        $prompt = "Write a script for a short video, to be spoken by one presenter, in {$target}.\n"
            ."Topic: {$topic}\nTone: ".($tone !== '' ? $tone : 'friendly')."\nLength: about {$seconds} seconds (about {$words} words).\n"
            ."Start with a hook in the first line and end with a call to action. Write it as short spoken lines (one sentence each), with no headings, stage directions or emojis.\n"
            .'Return {"lines": [...]}.';

        return $this->lines($prompt, null, 0.8);
    }

    public function titles(string $context, string $language): array
    {
        $target = self::LANGUAGES[$language] ?? self::LANGUAGES['en'];
        $prompt = "Suggest 8 titles for a social media video, in {$target}. Make them specific and catchy but not misleading clickbait, at most 70 characters each.\n"
            ."What the video is about:\n{$context}\n"
            .'Return {"lines": [...]} with one title per item.';

        return array_slice($this->lines($prompt, null, 0.9), 0, 8);
    }

    public function highlights(array $lines, int $count): array
    {
        $transcript = implode("\n", array_map(fn ($l) => sprintf('[%.1f-%.1f] %s', $l['start'], $l['end'], $l['text']), $lines));
        $prompt = "Here is a timed video transcript (seconds). Pick the {$count} most interesting, quotable or important moments for short clips.\n"
            ."Each moment should be a self-contained 5–60 second range made of whole lines, using the times given. Do not overlap moments.\n"
            ."Give each a short title and a one-sentence reason, in the transcript's language.\n"
            ."Transcript:\n{$transcript}";
        $schema = ['type' => 'OBJECT', 'properties' => ['moments' => ['type' => 'ARRAY', 'items' => [
            'type' => 'OBJECT',
            'properties' => ['start' => ['type' => 'NUMBER'], 'end' => ['type' => 'NUMBER'], 'title' => ['type' => 'STRING'], 'reason' => ['type' => 'STRING']],
            'required' => ['start', 'end', 'title', 'reason'],
        ]]], 'required' => ['moments']];

        $answer = $this->ask($prompt, $schema, 0.3);
        $first = (float) ($lines[0]['start'] ?? 0);
        $last = (float) (end($lines)['end'] ?? 0);
        $moments = [];
        foreach ((array) ($answer['moments'] ?? []) as $m) {
            $start = max($first, (float) ($m['start'] ?? 0));
            $end = min($last, (float) ($m['end'] ?? 0));
            if ($end - $start >= 1) {
                $moments[] = ['start' => round($start, 2), 'end' => round($end, 2), 'title' => trim((string) ($m['title'] ?? '')), 'reason' => trim((string) ($m['reason'] ?? ''))];
            }
        }
        usort($moments, fn ($a, $b) => $a['start'] <=> $b['start']);

        return array_slice($moments, 0, $count);
    }

    /**
     * @return list<string>
     */
    private function lines(string $prompt, ?int $expected, float $temperature = 0.0): array
    {
        $schema = ['type' => 'OBJECT', 'properties' => ['lines' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']]], 'required' => ['lines']];
        $lines = array_values(array_map(fn ($l) => trim((string) $l), (array) ($this->ask($prompt, $schema, $temperature)['lines'] ?? [])));
        if ($expected !== null && count($lines) !== $expected) {
            AppLog::warning('ai.text_line_mismatch', ['model' => $this->usedModel, 'expected' => $expected, 'got' => count($lines)]);
            throw new AIProviderException('The AI answer did not match your lines. Please try again.');
        }
        $lines = $expected === null ? array_values(array_filter($lines, fn ($l) => $l !== '')) : $lines;
        if ($lines === []) {
            throw new AIProviderException('The AI did not return any text. Please try again.');
        }

        return $lines;
    }

    /**
     * Asks the text model for JSON matching `$schema`; when it is busy (429/5xx/timeout) after a
     * few spaced retries, tries the fallback models before giving up.
     *
     * @return array<string, mixed>
     */
    protected function ask(string $prompt, array $schema, float $temperature): array
    {
        $models = array_values(array_unique([$this->textModel, ...(array) config('ai.gemini.fallback_models', [])]));
        foreach ($models as $model) {
            try {
                $response = Http::acceptJson()
                    ->withHeaders(['x-goog-api-key' => $this->apiKey])
                    ->timeout((int) config('ai.gemini.cleanup_timeout', 45) + 30)
                    ->retry(2, fn (int $attempt) => $attempt * 3000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                    ->post("{$this->baseUrl}/models/{$model}:generateContent", [
                        'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                        'generationConfig' => [
                            'temperature' => $temperature,
                            'responseMimeType' => 'application/json',
                            'responseSchema' => $schema,
                            ...(preg_match('/gemini-(\d+)/', $model, $m) && (int) $m[1] >= 3 ? ['thinkingConfig' => ['thinkingLevel' => 'low']] : []),
                        ],
                    ]);
            } catch (\Throwable $e) {
                AppLog::warning('ai.text_failed', ['model' => $model, 'error' => $e->getMessage()]);

                continue;
            }
            if (in_array($response->status(), [400, 401, 403], true) && ! str_contains((string) $response->json('error.message'), 'model')) {
                AppLog::warning('ai.text_rejected', ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);
                throw new AIProviderException('Google rejected the request. Check your API key in Account & usage.');
            }
            if (! $response->successful()) {
                AppLog::warning('ai.text_failed', ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);

                continue;
            }
            $decoded = json_decode((string) $response->json('candidates.0.content.parts.0.text'), true);
            if (is_array($decoded)) {
                $this->usedModel = $model;

                return $decoded;
            }
            AppLog::warning('ai.text_unreadable', ['model' => $model]);
        }

        throw new AIProviderException('Google AI is busy right now. Please try again in a minute.');
    }
}
