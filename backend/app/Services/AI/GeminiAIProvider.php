<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Google Gemini speech-to-captions.
 *
 * - The API key travels in the `x-goog-api-key` header, never in the URL, so it
 *   cannot leak into logs, exception messages or proxies.
 * - Small audio is sent inline; larger files go through the Gemini Files API
 *   (resumable upload, streamed from disk — the file is never fully loaded in memory)
 *   and are deleted from Google once transcription finishes.
 * - Transient failures (429/5xx/connection) are retried with backoff.
 * - Any failure throws AIProviderException with a user-safe message. It never
 *   substitutes sample captions.
 */
class GeminiAIProvider implements AIProviderInterface
{
    private const RETRYABLE = [408, 429, 500, 502, 503, 504];

    /** Statuses meaning "this model is busy" — worth trying a fallback model. */
    private const OVERLOADED = [429, 500, 502, 503, 504];

    public function __construct(
        protected ?string $apiKey = null,
        protected ?string $model = null,
        protected ?string $baseUrl = null,
        protected ?string $uploadUrl = null,
        /** True when the key belongs to the user (BYOK) — changes the wording of key errors. */
        protected bool $isUserKey = false,
    ) {
        $this->apiKey ??= config('ai.gemini.api_key');
        $this->model ??= (string) config('ai.gemini.model');
        $this->baseUrl ??= rtrim((string) config('ai.gemini.base_url'), '/');
        $this->uploadUrl ??= rtrim((string) config('ai.gemini.upload_url'), '/');
    }

    public function name(): string
    {
        return 'gemini';
    }

    public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
    {
        if (empty($this->apiKey)) {
            throw new AIProviderException('AI captioning is not configured on this server. Please contact support.', ['reason' => 'missing_api_key']);
        }
        if (! is_file($audioFilePath) || filesize($audioFilePath) === 0) {
            throw new AIProviderException('We could not read the audio from this video.', ['reason' => 'missing_audio_file']);
        }

        $mime = $this->mimeType($audioFilePath);
        $size = (int) filesize($audioFilePath);
        $uploadedFile = null;

        try {
            if ($size <= (int) config('ai.gemini.inline_max_bytes')) {
                $mediaPart = ['inlineData' => ['mimeType' => $mime, 'data' => base64_encode((string) file_get_contents($audioFilePath))]];
            } else {
                $uploadedFile = $this->uploadFile($audioFilePath, $mime, $size);
                $mediaPart = ['fileData' => ['mimeType' => $mime, 'fileUri' => $uploadedFile['uri']]];
            }

            return $this->generateWithFallback($mediaPart, $language, $options['duration'] ?? null, $size, (bool) $uploadedFile);
        } catch (ConnectionException $e) {
            AppLog::error('ai.connection_failed', ['provider' => 'gemini', 'model' => $this->model, 'stage' => 'upload'], $e);
            throw new AIProviderException('The AI service could not be reached. Please try again in a few minutes.', [], $e);
        } finally {
            if ($uploadedFile) {
                $this->deleteFile($uploadedFile['name']);
            }
        }
    }

    /**
     * Tries the configured model, then each fallback model, moving on only when Google is
     * overloaded (429/500/503/504), times out, or the fallback model doesn't exist.
     * Any other error (bad key, bad request, safety block) stops immediately.
     */
    protected function generateWithFallback(array $mediaPart, string $language, ?float $duration, int $size, bool $viaFileApi): array
    {
        $models = array_values(array_unique(array_filter([$this->model, ...(array) config('ai.gemini.fallback_models', [])])));
        $lastOverload = null;

        foreach ($models as $i => $model) {
            $startedAt = microtime(true);
            AppLog::info('ai.request_started', ['provider' => 'gemini', 'model' => $model, 'attempt' => $i + 1, 'audio_bytes' => $size, 'mode' => $viaFileApi ? 'file_api' : 'inline', 'word_timings' => $this->wantsWordTimings()]);

            try {
                $response = $this->send($model, $mediaPart, $language, withThinkingConfig: true);
                // Older models reject thinking settings: resend once without them.
                if ($response->status() === 400 && stripos((string) $response->json('error.message'), 'thinking') !== false) {
                    $response = $this->send($model, $mediaPart, $language, withThinkingConfig: false);
                }
            } catch (ConnectionException $e) {
                if (! self::isTimeout($e)) {
                    AppLog::error('ai.connection_failed', ['provider' => 'gemini', 'model' => $model], $e);
                    throw new AIProviderException('The AI service could not be reached. Please try again in a few minutes.', [], $e);
                }
                AppLog::error('ai.timeout', ['provider' => 'gemini', 'model' => $model, 'timeout' => (int) config('ai.gemini.timeout')]);
                $lastOverload = 'timeout';

                continue;
            }

            $status = $response->status();
            $isFallback = $i > 0;
            if (in_array($status, self::OVERLOADED, true) || ($isFallback && $status === 404)) {
                AppLog::warning('ai.model_unavailable', [
                    'provider' => 'gemini', 'model' => $model, 'status' => $status,
                    'provider_error' => mb_substr((string) ($response->json('error.message') ?? ''), 0, 300),
                ]);
                $lastOverload = $status === 404 ? $lastOverload : 'overloaded';

                continue;
            }

            $this->model = $model; // for logging/usage below
            $this->assertSuccessful($response, 'generate');
            AppLog::info('ai.request_completed', ['provider' => 'gemini', 'model' => $model, 'seconds' => round(microtime(true) - $startedAt, 1), 'output_tokens' => $response->json('usageMetadata.candidatesTokenCount')]);

            return $this->parse($response, $language, $duration);
        }

        throw new AIProviderException($lastOverload === 'timeout'
            ? 'Google’s AI took too long to answer. It is probably overloaded right now — please retry in a few minutes.'
            : 'Google’s AI is overloaded right now (high demand). Please retry in a few minutes.', ['reason' => $lastOverload ?? 'overloaded']);
    }

    protected function send(string $model, array $mediaPart, string $language, bool $withThinkingConfig): Response
    {
        $generationConfig = [
            'temperature' => 0.1,
            'responseMimeType' => 'application/json',
            'responseSchema' => $this->responseSchema(),
            'maxOutputTokens' => (int) config('ai.gemini.max_output_tokens'),
        ];
        if ($withThinkingConfig && ($thinking = $this->thinkingConfig($model))) {
            $generationConfig['thinkingConfig'] = $thinking;
        }

        return $this->request()
            ->timeout((int) config('ai.gemini.timeout'))
            ->post("{$this->baseUrl}/models/{$model}:generateContent", [
                'contents' => [['role' => 'user', 'parts' => [$mediaPart, ['text' => $this->prompt($language)]]]],
                'generationConfig' => $generationConfig,
            ]);
    }

    /**
     * Transcription needs no long reasoning; keeping "thinking" minimal makes responses much
     * faster. Gemini 3 uses thinkingLevel, Gemini 2.5 uses thinkingBudget.
     */
    protected function thinkingConfig(string $model): ?array
    {
        $level = (string) config('ai.gemini.thinking', 'low');
        if ($level === '' || $level === 'default') {
            return null;
        }
        if (preg_match('/gemini-(\d+)/', $model, $m) && (int) $m[1] >= 3) {
            return ['thinkingLevel' => $level === 'high' ? 'high' : 'low'];
        }
        if (str_contains($model, '2.5')) {
            return ['thinkingBudget' => $level === 'high' ? -1 : (str_contains($model, 'pro') ? 128 : 0)];
        }

        return null;
    }

    protected function request(): PendingRequest
    {
        return Http::acceptJson()
            ->withHeaders(['x-goog-api-key' => (string) $this->apiKey])
            ->retry(
                3,
                fn (int $attempt) => [3000, 8000, 15000][$attempt - 1] ?? 15000,
                fn (\Throwable $e) => ($e instanceof ConnectionException && ! self::isTimeout($e))
                    || ($e instanceof RequestException && in_array($e->response->status(), self::RETRYABLE, true)),
                throw: false,
            );
    }

    /** cURL error 28 = operation timed out. */
    public static function isTimeout(\Throwable $e): bool
    {
        return str_contains($e->getMessage(), 'cURL error 28') || stripos($e->getMessage(), 'timed out') !== false;
    }

    /**
     * Asking for per-word timings multiplies the response size (and time). By default the
     * app estimates word timings from each line's timing instead (WordTimingEstimator).
     */
    protected function wantsWordTimings(): bool
    {
        return (bool) config('ai.gemini.word_timings', false);
    }

    /** @return array{name: string, uri: string} */
    protected function uploadFile(string $path, string $mime, int $size): array
    {
        $start = $this->request()
            ->timeout(60)
            ->withHeaders([
                'X-Goog-Upload-Protocol' => 'resumable',
                'X-Goog-Upload-Command' => 'start',
                'X-Goog-Upload-Header-Content-Length' => (string) $size,
                'X-Goog-Upload-Header-Content-Type' => $mime,
            ])
            ->post("{$this->uploadUrl}/files", ['file' => ['display_name' => basename($path)]]);
        $this->assertSuccessful($start, 'upload_start');

        $sessionUrl = $start->header('x-goog-upload-url');
        if (! $sessionUrl) {
            throw new AIProviderException('The AI service rejected the audio upload. Please try again.', ['reason' => 'no_upload_url']);
        }

        $stream = fopen($path, 'rb');
        try {
            $upload = Http::withHeaders([
                'Content-Length' => (string) $size,
                'X-Goog-Upload-Offset' => '0',
                'X-Goog-Upload-Command' => 'upload, finalize',
            ])->timeout((int) config('ai.gemini.timeout'))
                ->withBody(Utils::streamFor($stream), $mime)
                ->post($sessionUrl);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        $this->assertSuccessful($upload, 'upload');

        $file = $upload->json('file') ?? [];
        $deadline = microtime(true) + 120;
        while (($file['state'] ?? 'ACTIVE') === 'PROCESSING' && microtime(true) < $deadline) {
            usleep(2_000_000);
            $poll = $this->request()->timeout(30)->get("{$this->baseUrl}/{$file['name']}");
            $this->assertSuccessful($poll, 'upload_poll');
            $file = $poll->json() ?? [];
        }
        if (($file['state'] ?? '') !== 'ACTIVE' || empty($file['uri'])) {
            AppLog::error('ai.upload_not_active', ['provider' => 'gemini', 'state' => $file['state'] ?? null]);
            throw new AIProviderException('The AI service could not process this audio. Please try again.');
        }

        return ['name' => $file['name'], 'uri' => $file['uri']];
    }

    protected function deleteFile(string $name): void
    {
        try {
            Http::withHeaders(['x-goog-api-key' => (string) $this->apiKey])->timeout(15)->delete("{$this->baseUrl}/{$name}");
        } catch (\Throwable $e) {
            AppLog::warning('ai.file_cleanup_failed', ['provider' => 'gemini', 'file' => $name, 'error' => $e->getMessage()]);
        }
    }

    protected function assertSuccessful(Response $response, string $stage): void
    {
        if ($response->successful()) {
            return;
        }

        $status = $response->status();
        $providerError = $response->json('error.message') ?? mb_substr($response->body(), 0, 500);
        $reason = collect($response->json('error.details') ?? [])->pluck('reason')->filter()->first();
        $keyRejected = GeminiKeyVerifier::isKeyRejection($status, $providerError, $reason);
        AppLog::error('ai.request_failed', [
            'provider' => 'gemini',
            'model' => $this->model,
            'stage' => $stage,
            'status' => $status,
            'user_key' => $this->isUserKey,
            'key_rejected' => $keyRejected,
            'provider_error' => $providerError,
        ]);

        if ($keyRejected) {
            throw new AIProviderException(
                $this->isUserKey
                    ? 'Google rejected your AI API key. Update or verify it in Account & usage, then retry.'
                    : 'AI captioning is temporarily unavailable. Please contact support.',
                ['status' => $status, 'stage' => $stage, 'key_rejected' => true],
            );
        }

        $message = match (true) {
            $status === 503 => 'Google’s AI is overloaded right now (high demand). Please retry in a few minutes.',
            $status === 429 => $this->isUserKey
                ? 'Your Google AI key has run out of quota. Check your limits in Google AI Studio, then retry.'
                : 'The AI service is busy right now. Please try again in a few minutes.',
            $status === 400 => 'The AI service could not process this audio.',
            default => 'The AI service failed to respond. Please try again.',
        };

        throw new AIProviderException($message, ['status' => $status, 'stage' => $stage]);
    }

    protected function parse(Response $response, string $language, ?float $duration): array
    {
        $candidate = $response->json('candidates.0') ?? [];
        $finish = $candidate['finishReason'] ?? null;
        $text = collect($candidate['content']['parts'] ?? [])->pluck('text')->filter()->implode('');

        if ($response->json('promptFeedback.blockReason') || $finish === 'SAFETY') {
            throw new AIProviderException('The AI service declined to transcribe this audio.', ['finish' => $finish]);
        }
        if ($finish === 'MAX_TOKENS') {
            throw new AIProviderException('This video has too much speech to caption in one pass. Try a shorter clip.', ['finish' => $finish]);
        }

        $decoded = json_decode($text, true);
        $raw = is_array($decoded) ? ($decoded['captions'] ?? $decoded['segments'] ?? (array_is_list($decoded) ? $decoded : null)) : null;
        if (! is_array($raw)) {
            AppLog::error('ai.invalid_response', ['provider' => 'gemini', 'model' => $this->model, 'finish' => $finish, 'sample' => mb_substr($text, 0, 300)]);
            throw new AIProviderException('The AI service returned an unexpected response. Please try again.');
        }

        $segments = SegmentNormalizer::normalize($raw, $language, $duration);
        $detected = in_array($decoded['language'] ?? null, ['si', 'en'], true)
            ? $decoded['language']
            : ($language !== 'auto' ? $language : ($segments[0]['language'] ?? 'si'));

        return [
            'text' => implode(' ', array_column($segments, 'text')),
            'language' => $detected,
            'segments' => $segments,
            'usage' => array_filter([
                'model' => $this->model,
                'input_tokens' => $response->json('usageMetadata.promptTokenCount'),
                'output_tokens' => $response->json('usageMetadata.candidatesTokenCount'),
            ], fn ($v) => $v !== null),
        ];
    }

    protected function prompt(string $language): string
    {
        $langInstruction = match ($language) {
            'si' => 'The audio is primarily in Sinhala (සිංහල). Transcribe using correct, standard Sinhala Unicode (including ZWJ conjuncts such as ශ්‍රී). Keep English words that are spoken in English in Latin script.',
            'en' => 'The audio is in English. Transcribe with accurate grammar, capitalization and punctuation.',
            default => 'Detect the spoken language (Sinhala or English, possibly mixed). Write Sinhala in Sinhala Unicode and English in Latin script.',
        };

        $wordsInstruction = $this->wantsWordTimings() ? ', plus per-word timings' : '. Do not include per-word timings';

        return <<<PROMPT
You are a professional subtitle transcription engine.
{$langInstruction}

Transcribe ONLY what is actually spoken. Do not invent, summarise or translate. Skip silence and music.
Split speech into natural subtitle lines of roughly 3–8 words (at most ~42 characters).
Give start and end times in seconds relative to the beginning of the audio{$wordsInstruction}.
Set "language" on each line to "si" or "en".
If nothing is spoken, return an empty "captions" array.
PROMPT;
    }

    protected function responseSchema(): array
    {
        $word = ['type' => 'OBJECT', 'properties' => ['word' => ['type' => 'STRING'], 'start' => ['type' => 'NUMBER'], 'end' => ['type' => 'NUMBER']], 'required' => ['word', 'start', 'end']];

        return [
            'type' => 'OBJECT',
            'properties' => [
                'language' => ['type' => 'STRING', 'enum' => ['si', 'en']],
                'captions' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'text' => ['type' => 'STRING'],
                            'language' => ['type' => 'STRING', 'enum' => ['si', 'en']],
                            'start' => ['type' => 'NUMBER'],
                            'end' => ['type' => 'NUMBER'],
                            ...($this->wantsWordTimings() ? ['words' => ['type' => 'ARRAY', 'items' => $word]] : []),
                        ],
                        'required' => ['text', 'start', 'end'],
                    ],
                ],
            ],
            'required' => ['captions'],
        ];
    }

    protected function mimeType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'wav' => 'audio/wav',
            'm4a' => 'audio/mp4',
            'aac' => 'audio/aac',
            'ogg' => 'audio/ogg',
            'flac' => 'audio/flac',
            'mp4' => 'video/mp4',
            'mov' => 'video/quicktime',
            'webm' => 'video/webm',
            default => 'audio/mpeg',
        };
    }
}
