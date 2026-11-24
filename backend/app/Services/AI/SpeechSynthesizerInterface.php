<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;

/** Text to speech for voice-overs. */
interface SpeechSynthesizerInterface
{
    public function model(): ?string;

    /**
     * Spoken audio for `$text` as WAV bytes.
     *
     * @throws AIProviderException
     */
    public function speak(string $text, string $voice, string $style = ''): string;
}
