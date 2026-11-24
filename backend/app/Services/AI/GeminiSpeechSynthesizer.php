<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;
use App\Support\Wav;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/** Text to speech with Gemini's speech model, returned as WAV (24 kHz mono). */
class GeminiSpeechSynthesizer implements SpeechSynthesizerInterface
{
    public const VOICES = ['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda', 'Orus', 'Zephyr'];

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

    public function speak(string $text, string $voice, string $style = ''): string
    {
        $voice = in_array($voice, self::VOICES, true) ? $voice : self::VOICES[0];
        $prompt = $style !== '' ? "Say this {$style}:\n{$text}" : $text;
        try {
            $response = Http::acceptJson()
                ->withHeaders(['x-goog-api-key' => $this->apiKey])
                ->timeout((int) config('ai.gemini.timeout', 120))
                ->retry(2, fn (int $attempt) => $attempt * 3000, fn ($e) => $e instanceof RequestException && in_array($e->response->status(), [429, 500, 503], true), throw: false)
                ->post("{$this->baseUrl}/models/{$this->speechModel}:generateContent", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => [
                        'responseModalities' => ['AUDIO'],
                        'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $voice]]],
                    ],
                ]);
        } catch (\Throwable $e) {
            AppLog::warning('ai.speech_failed', ['model' => $this->speechModel, 'error' => $e->getMessage()]);
            throw new AIProviderException('Google AI is busy right now. Please try again in a minute.', [], $e);
        }
        if (! $response->successful()) {
            AppLog::warning('ai.speech_failed', ['model' => $this->speechModel, 'status' => $response->status(), 'provider_error' => $response->json('error.message')]);
            throw new AIProviderException(in_array($response->status(), [401, 403], true)
                ? 'Google rejected the request. Check your API key in Account & usage.'
                : 'The voice could not be made right now. Please try again in a minute.');
        }
        $pcm = base64_decode((string) $response->json('candidates.0.content.parts.0.inlineData.data'), true);
        if (! is_string($pcm) || $pcm === '') {
            AppLog::warning('ai.speech_empty', ['model' => $this->speechModel, 'finish' => $response->json('candidates.0.finishReason')]);
            throw new AIProviderException('The AI did not return any speech for this text. Try shorter or simpler text.');
        }
        $this->usedModel = $this->speechModel;

        return Wav::fromPcm16($pcm, self::SAMPLE_RATE);
    }
}
