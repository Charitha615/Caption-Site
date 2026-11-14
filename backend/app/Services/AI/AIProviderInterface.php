<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;

/**
 * Speech-to-caption provider. Implementations: GeminiAIProvider (production),
 * FakeAIProvider (local development without an API key, and tests).
 *
 * Adding a provider (Whisper, Deepgram, …): implement this interface and register it
 * in config/ai.php → AppServiceProvider resolves it by name.
 */
interface AIProviderInterface
{
    /** Stable provider identifier, stored with usage records. */
    public function name(): string;

    /**
     * Transcribe an audio (or video) file into timed caption segments.
     *
     * @param  string  $audioFilePath  absolute local path
     * @param  string  $language  'si', 'en' or 'auto'
     * @param  array{duration?: float}  $options
     * @return array{
     *     text: string,
     *     language: string,
     *     segments: list<array{text: string, language: string, start: float, end: float, words: list<array{word: string, start: float, end: float}>}>,
     *     usage: array{model?: string, input_tokens?: int, output_tokens?: int}
     * }
     *
     * @throws AIProviderException with a user-safe message
     */
    public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array;
}
