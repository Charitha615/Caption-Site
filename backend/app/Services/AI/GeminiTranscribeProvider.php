<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;

/**
 * Speech-to-text with Gemini 3.5 Transcribe (Interactions API).
 *
 * Audio goes through the Files API, then POST /interactions with a transcription_config
 * asking for word timestamps (and speaker labels). The returned words are grouped into
 * caption lines by CaptionLineBuilder; word timings are kept exactly as transcribed.
 *
 * Language: 'en' → en-US hint; 'si' → si-LK hint, retried with auto-detect if the model
 * refuses the hint (Sinhala is not on the model's published list); 'auto' → auto-detect,
 * which also covers Sinhala-English code-switching.
 *
 * Errors throw AIProviderException; FallbackTranscriber then retries with the text model.
 */
class GeminiTranscribeProvider extends GeminiAIProvider
{
    public function __construct(?string $apiKey = null, ?string $model = null, bool $isUserKey = false)
    {
        parent::__construct(apiKey: $apiKey, model: $model ?? (string) config('ai.gemini.transcribe_model'), isUserKey: $isUserKey);
    }

    public function name(): string
    {
        return 'gemini-transcribe';
    }

    public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
    {
        if (empty($this->apiKey)) {
            throw new AIProviderException('AI captioning is not configured on this server. Please contact support.', ['reason' => 'missing_api_key']);
        }
        if (! is_file($audioFilePath) || filesize($audioFilePath) === 0) {
            throw new AIProviderException('We could not read the audio from this video.', ['reason' => 'missing_audio_file']);
        }

        $size = (int) filesize($audioFilePath);
        $file = null;
        $startedAt = microtime(true);

        try {
            $mime = $this->mimeType($audioFilePath);
            $file = $this->uploadFile($audioFilePath, $mime, $size);
            AppLog::info('ai.request_started', ['provider' => $this->name(), 'model' => $this->model, 'audio_bytes' => $size, 'language' => $language]);

            $hints = self::languageHints($language);
            $response = $this->interact($file['uri'], $mime, $hints);
            // The model may reject a language it does not officially list (e.g. si-LK): auto-detect instead.
            if ($hints && $response->status() === 400 && self::isLanguageError((string) $response->json('error.message'))) {
                AppLog::warning('ai.language_hint_rejected', ['model' => $this->model, 'hints' => $hints, 'provider_error' => $response->json('error.message')]);
                $response = $this->interact($file['uri'], $mime, []);
            }
            $this->assertSuccessful($response, 'transcribe');
            $interaction = $this->awaitCompletion($response->json() ?? []);

            $result = $this->parseTranscript($interaction, $language, $options['duration'] ?? null);
            AppLog::info('ai.request_completed', ['provider' => $this->name(), 'model' => $this->model, 'seconds' => round(microtime(true) - $startedAt, 1), 'words' => $result['usage']['words']]);

            return $result;
        } catch (ConnectionException $e) {
            AppLog::error(self::isTimeout($e) ? 'ai.timeout' : 'ai.connection_failed', ['provider' => $this->name(), 'model' => $this->model], $e);
            throw new AIProviderException('The transcription service could not be reached.', ['reason' => self::isTimeout($e) ? 'timeout' : 'connection'], $e);
        } finally {
            if ($file) {
                $this->deleteFile($file['name']);
            }
        }
    }

    /** @return list<string> */
    public static function languageHints(string $language): array
    {
        return match ($language) {
            'en' => ['en-US'],
            'si' => ['si-LK'],
            default => [], // auto-detect, incl. Sinhala-English mixed speech
        };
    }

    /** A 400 about the language hint (as opposed to any other bad request). */
    public static function isLanguageError(string $message): bool
    {
        return (bool) preg_match('/language|locale|bcp-?47|si-LK/i', $message);
    }

    protected function interact(string $fileUri, string $mimeType, array $languageCodes): Response
    {
        $mode = ['type' => 'verbatim', 'timestamp_granularities' => ['word']];
        if (config('ai.gemini.diarization', true)) {
            $mode['diarization_mode'] = 'speaker';
        }
        $transcription = ['mode' => $mode];
        if ($languageCodes) {
            $transcription['language_codes'] = $languageCodes;
        }

        return $this->request()
            ->timeout((int) config('ai.gemini.timeout'))
            ->post("{$this->baseUrl}/interactions", [
                'model' => 'models/'.$this->model,
                'input' => [['type' => 'audio', 'uri' => $fileUri, 'mime_type' => $mimeType]],
                'generation_config' => ['transcription_config' => $transcription],
            ]);
    }

    /** Interactions normally complete in the response; poll if one is still running. */
    protected function awaitCompletion(array $interaction): array
    {
        $deadline = microtime(true) + (int) config('ai.gemini.timeout');
        while (in_array($interaction['status'] ?? 'completed', ['queued', 'pending', 'in_progress', 'running'], true)) {
            if (microtime(true) > $deadline || empty($interaction['id'])) {
                throw new AIProviderException('The transcription took too long.', ['reason' => 'timeout']);
            }
            usleep(3_000_000);
            $poll = $this->request()->timeout(30)->get("{$this->baseUrl}/{$interaction['id']}");
            $this->assertSuccessful($poll, 'transcribe_poll');
            $interaction = $poll->json() ?? [];
        }
        if (($interaction['status'] ?? 'completed') !== 'completed') {
            throw new AIProviderException('The transcription did not complete.', ['reason' => 'status_'.($interaction['status'] ?? 'unknown')]);
        }

        return $interaction;
    }

    protected function parseInteraction(array $interaction): array
    {
        $words = [];
        $text = '';
        foreach ($interaction['steps'] ?? [] as $step) {
            foreach ($step['content'] ?? [] as $part) {
                if (($part['type'] ?? null) !== 'text') {
                    continue;
                }
                $text .= ($text === '' ? '' : ' ').trim((string) ($part['text'] ?? ''));
                foreach ($part['annotations'] ?? [] as $a) {
                    if (($a['type'] ?? null) !== 'word_info' || trim((string) ($a['text'] ?? '')) === '') {
                        continue;
                    }
                    $words[] = [
                        'word' => trim((string) $a['text']),
                        'start' => self::seconds($a['start_offset'] ?? null),
                        'end' => self::seconds($a['end_offset'] ?? null),
                        'speaker' => $a['speaker'] ?? null,
                    ];
                }
            }
        }

        return [$text, $words];
    }

    protected function parseTranscript(array $interaction, string $language, ?float $duration): array
    {
        [$text, $words] = $this->parseInteraction($interaction);

        if (! $words) {
            // Text without timings can't become timed captions — let the fallback handle it.
            throw new AIProviderException('The transcription returned no word timings.', ['reason' => $text === '' ? 'empty' : 'no_timestamps']);
        }

        usort($words, fn ($a, $b) => $a['start'] <=> $b['start']);
        if ($duration) {
            $words = array_values(array_filter($words, fn ($w) => $w['start'] < $duration));
        }
        foreach ($words as &$w) {
            $w['end'] = max($w['end'], $w['start'] + 0.05);
        }
        unset($w);

        $lines = CaptionLineBuilder::build($words, $language);
        $segments = SegmentNormalizer::normalize($lines, $language, $duration);
        // Normalizer re-derives words; restore the exact transcribed timings (and speakers).
        foreach ($segments as $i => &$seg) {
            if (isset($lines[$i]) && abs($lines[$i]['start'] - $seg['start']) < 0.01) {
                $seg['words'] = $lines[$i]['words'];
                $seg['speaker'] = $lines[$i]['speaker'];
            }
        }
        unset($seg);

        $siLines = count(array_filter($segments, fn ($s) => $s['language'] === 'si'));

        return [
            'text' => $text !== '' ? $text : implode(' ', array_column($words, 'word')),
            'language' => $language !== 'auto' ? $language : ($siLines >= count($segments) / 2 ? 'si' : 'en'),
            'segments' => $segments,
            'words' => $words,
            'usage' => ['model' => $this->model, 'words' => count($words)],
        ];
    }

    /** "1.500s" → 1.5 */
    public static function seconds(mixed $offset): float
    {
        if (is_numeric($offset)) {
            return round((float) $offset, 3);
        }

        return round((float) rtrim((string) $offset, 's'), 3);
    }
}
