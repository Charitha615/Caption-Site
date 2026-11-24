<?php

namespace App\Services\AI;

use App\Support\Wav;

/** A short tone instead of speech, for tests and local runs without a Gemini key. */
class FakeSpeechSynthesizer implements SpeechSynthesizerInterface
{
    public function model(): ?string
    {
        return 'fake';
    }

    public function speak(string $text, string $voice, string $style = ''): string
    {
        $rate = 16000;
        $pcm = '';
        for ($i = 0; $i < $rate; $i++) {
            $pcm .= pack('v', (int) (sin(2 * M_PI * 440 * $i / $rate) * 3000) & 0xFFFF);
        }

        return Wav::fromPcm16($pcm, $rate);
    }
}
