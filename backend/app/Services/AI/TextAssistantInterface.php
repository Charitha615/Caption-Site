<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;

/**
 * Writing help for the video editor: script conversion, translation, scripts, titles and highlights.
 *
 * Implementations: GeminiTextAssistant (the user's key), FakeTextAssistant (tests, local runs without a key).
 * Every method throws AIProviderException with a user-safe message when no answer could be had.
 */
interface TextAssistantInterface
{
    /** The model that answered the last request, for usage records. */
    public function model(): ?string;

    /**
     * Singlish (Sinhala written in English letters, "kohomada") → Sinhala script, one line per line.
     *
     * @param  list<string>  $lines
     * @return list<string>
     *
     * @throws AIProviderException
     */
    public function singlishToSinhala(array $lines): array;

    /**
     * Translates every line into `$to` ('si', 'en' or 'ta'), one line per line.
     *
     * @param  list<string>  $lines
     * @return list<string>
     *
     * @throws AIProviderException
     */
    public function translate(array $lines, string $to): array;

    /**
     * A video script, as short spoken lines.
     *
     * @return list<string>
     *
     * @throws AIProviderException
     */
    public function script(string $topic, string $language, int $seconds, string $tone): array;

    /**
     * Title ideas for a video, from its transcript or a description.
     *
     * @return list<string>
     *
     * @throws AIProviderException
     */
    public function titles(string $context, string $language): array;

    /**
     * The most interesting moments of a transcript.
     *
     * @param  list<array{start: float, end: float, text: string}>  $lines
     * @return list<array{start: float, end: float, title: string, reason: string}>
     *
     * @throws AIProviderException
     */
    public function highlights(array $lines, int $count): array;
}
