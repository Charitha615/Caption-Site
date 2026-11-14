<?php

namespace App\Services\Video\Contracts;

/**
 * Media probing and conversion. All methods take local absolute paths and throw
 * App\Exceptions\VideoProcessingException (user-safe message) on failure.
 */
interface VideoServiceInterface
{
    /**
     * @return array{duration: float, width: int, height: int, fps: float, codec: ?string, audio_codec: ?string, sample_rate: ?int, channels: ?int, has_audio: bool}
     */
    public function getMetadata(string $filePath): array;

    /** Extracts a 16 kHz mono MP3 suitable for speech recognition. */
    public function extractAudio(string $videoPath, string $outputPath): string;

    /**
     * Splits audio into consecutive pieces of at most $seconds each.
     *
     * @return list<array{path: string, offset: float, duration: float}>
     */
    public function splitAudio(string $audioPath, float $totalSeconds, int $seconds, string $outputDir): array;

    /** Writes a JPEG frame. Best effort: returns false instead of throwing. */
    public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool;
}
