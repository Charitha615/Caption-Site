<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;
use App\Support\Wav;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Text to speech with Gemini's speech models (the voices of AI Studio's "Generate speech"), through
 * the Interactions API. Gemini 3.8 Flash TTS speaks Sinhala, Tamil and English among 130+ languages;
 * when it fails, the Flash-Lite TTS model is tried before giving up.
 */
class GeminiSpeechSynthesizer implements SpeechSynthesizerInterface
{
    /**
     * AI Studio's prebuilt voices with their descriptions; used when the live voice list can't be read.
     *
     * @var array<string, string>
     */
    public const VOICES = [
        'Zephyr' => 'Bright', 'Puck' => 'Upbeat', 'Charon' => 'Informative', 'Kore' => 'Firm', 'Fenrir' => 'Excitable',
        'Leda' => 'Youthful', 'Orus' => 'Firm', 'Aoede' => 'Breezy', 'Callirrhoe' => 'Easy-going', 'Autonoe' => 'Bright',
        'Enceladus' => 'Breathy', 'Iapetus' => 'Clear', 'Umbriel' => 'Easy-going', 'Algieba' => 'Smooth', 'Despina' => 'Smooth',
        'Erinome' => 'Clear', 'Algenib' => 'Gravelly', 'Rasalgethi' => 'Informative', 'Laomedeia' => 'Upbeat', 'Achernar' => 'Soft',
        'Alnilam' => 'Firm', 'Schedar' => 'Even', 'Gacrux' => 'Mature', 'Pulcherrima' => 'Forward', 'Achird' => 'Friendly',
        'Zubenelgenubi' => 'Casual', 'Vindemiatrix' => 'Gentle', 'Sadachbia' => 'Lively', 'Sadaltager' => 'Knowledgeable', 'Sulafat' => 'Warm',
    ];

    private const SAMPLE_RATE = 24000;

    private ?string $usedModel = null;

    public function __construct(
        protected string $apiKey,
        protected ?string $speechModel = null,
        protected ?string $baseUrl = null,
    ) {
        $this->speechModel ??= (string) config('ai.gemini.tts_model');
        $this->baseUrl ??= rtrim((string) config('ai.gemini.base_url'), '/');
    }

    public function model(): ?string
    {
        return $this->usedModel;
    }

    /** Emoji and other pictographs can't be spoken (and can make the model refuse); they are left out. */
    public static function speakable(string $text): string
    {
        $text = (string) preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}\x{1F1E6}-\x{1F1FF}]/u', '', $text);

        return trim((string) preg_replace('/[ \t]{2,}/u', ' ', $text));
    }

    public function speak(string $text, string $voice, string $style = ''): string
    {
        $text = self::speakable($text);
        if ($text === '') {
            throw new AIProviderException('There are no words to speak in this text.');
        }
        $models = array_values(array_unique(array_filter([$this->speechModel, (string) config('ai.gemini.tts_fallback_model')])));
        $lastError = 'The voice could not be made right now. Please try again in a minute.';
        foreach ($models as $model) {
            try {
                $response = $this->request()->timeout((int) config('ai.gemini.timeout', 120))->post("{$this->baseUrl}/interactions", [
                    'model' => 'models/'.$model,
                    'input' => [[
                        'type' => 'user_input',
                        'content' => [array_filter([
                            'type' => 'text',
                            'text' => $text,
                            'annotations' => $style !== '' ? [['type' => 'speech_metadata', 'style' => $style]] : null,
                        ])],
                    ]],
                    'response_format' => ['type' => 'audio', 'mime_type' => 'audio/wav'],
                    'generation_config' => ['speech_config' => [['voice' => $voice]]],
                ]);
            } catch (\Throwable $e) {
                AppLog::warning('ai.speech_failed', ['model' => $model, 'error' => $e->getMessage()]);

                continue;
            }
            if (in_array($response->status(), [401, 403], true)) {
                AppLog::warning('ai.speech_rejected', ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);
                throw new AIProviderException('Google rejected the request. Check your API key in Account & usage.');
            }
            if (! $response->successful()) {
                AppLog::warning('ai.speech_failed', ['model' => $model, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);
                if ($response->status() === 400 && ! str_contains(strtolower((string) $response->json('error.message')), 'model')) {
                    $lastError = 'Google could not read this request. Try a different voice or simpler text.';
                }

                continue;
            }
            $audio = self::audioFrom($response->json() ?? []);
            if ($audio === null) {
                AppLog::warning('ai.speech_empty', ['model' => $model, 'status' => $response->json('status')]);
                $lastError = 'The AI did not return any speech for this text. Try shorter or simpler text.';

                continue;
            }
            $this->usedModel = $model;

            // Unary answers are a WAV file; raw 16-bit PCM gets a header.
            return str_starts_with($audio, 'RIFF') ? $audio : Wav::fromPcm16($audio, self::SAMPLE_RATE);
        }

        throw new AIProviderException($lastError);
    }

    /**
     * The decoded audio of an interaction: the last audio block of its model output (as AI Studio's
     * examples read it), or `output_audio` when the API returns that shorthand.
     */
    public static function audioFrom(array $interaction): ?string
    {
        $data = null;
        foreach ($interaction['steps'] ?? [] as $step) {
            foreach ($step['content'] ?? [] as $part) {
                if (($part['type'] ?? null) === 'audio' && ! empty($part['data'])) {
                    $data = $part['data'];
                }
            }
        }
        $data ??= $interaction['output_audio']['data'] ?? null;
        $bytes = is_string($data) ? base64_decode($data, true) : false;

        return is_string($bytes) && $bytes !== '' ? $bytes : null;
    }

    /**
     * Voices to choose from: Google's live catalogue of prebuilt voices (cached for a day), or the
     * built-in AI Studio list when it can't be read.
     *
     * @return list<array{id: string, name: string, description: string, gender: string|null}>
     */
    public function voices(): array
    {
        $fallback = self::builtInVoices();
        $cached = Cache::get('gemini-tts-voices');
        if (is_array($cached) && $cached !== []) {
            return $cached;
        }
        try {
            $response = $this->request()->timeout(15)->get("{$this->baseUrl}/voices", ['type' => 'prebuilt', 'page_size' => 1000]);
        } catch (\Throwable $e) {
            AppLog::warning('ai.voices_failed', ['error' => $e->getMessage()]);

            return $fallback;
        }
        $voices = $response->successful() ? self::parseVoices($response) : [];
        if ($voices === []) {
            AppLog::warning('ai.voices_failed', ['status' => $response->status()]);

            return $fallback;
        }
        Cache::put('gemini-tts-voices', $voices, now()->addDay());

        return $voices;
    }

    /** @return list<array{id: string, name: string, description: string, gender: string|null}> */
    public static function builtInVoices(): array
    {
        return array_map(fn ($name, $description) => ['id' => $name, 'name' => $name, 'description' => $description, 'gender' => null], array_keys(self::VOICES), self::VOICES);
    }

    /** @return list<array{id: string, name: string, description: string, gender: string|null}> */
    private static function parseVoices(Response $response): array
    {
        $out = [];
        foreach ((array) $response->json('voices', []) as $v) {
            $id = (string) ($v['id'] ?? $v['name'] ?? '');
            // Ids may come as "voices/Kore"; the speech request takes the bare name.
            $id = str_contains($id, '/') ? substr($id, strrpos($id, '/') + 1) : $id;
            if ($id === '' || ! preg_match('/^[A-Za-z0-9_\-]{1,80}$/', $id)) {
                continue;
            }
            $out[$id] = [
                'id' => $id,
                'name' => (string) ($v['display_name'] ?? $v['displayName'] ?? $id),
                'description' => trim((string) ($v['description'] ?? self::VOICES[$id] ?? '')),
                'gender' => isset($v['gender']) ? strtolower((string) $v['gender']) : null,
            ];
        }

        return array_values($out);
    }

    private function request(): PendingRequest
    {
        return Http::acceptJson()
            ->withHeaders(['x-goog-api-key' => $this->apiKey])
            ->retry(2, fn (int $attempt) => $attempt * 3000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false);
    }
}
