<?php

namespace App\Support;

/** Minimal WAV container for raw 16-bit PCM. */
class Wav
{
    public static function fromPcm16(string $pcm, int $sampleRate, int $channels = 1): string
    {
        $bytes = strlen($pcm);

        return 'RIFF'.pack('V', 36 + $bytes).'WAVE'
            .'fmt '.pack('VvvVVvv', 16, 1, $channels, $sampleRate, $sampleRate * $channels * 2, $channels * 2, 16)
            .'data'.pack('V', $bytes).$pcm;
    }

    /** Seconds of audio in a 16-bit PCM WAV, read from its header; 0 when it isn't one. */
    public static function duration(string $path): float
    {
        $head = @file_get_contents($path, false, null, 0, 44);
        if (! is_string($head) || strlen($head) < 44 || substr($head, 0, 4) !== 'RIFF' || substr($head, 8, 4) !== 'WAVE') {
            return 0.0;
        }
        $byteRate = unpack('V', substr($head, 28, 4))[1] ?? 0;
        $dataBytes = unpack('V', substr($head, 40, 4))[1] ?? 0;

        return $byteRate > 0 ? $dataBytes / $byteRate : 0.0;
    }
}
