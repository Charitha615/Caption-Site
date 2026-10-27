<?php

namespace App\Services\Video\Contracts;

interface VideoServiceInterface
{
    /**
     * Inspect video metadata using FFprobe (duration, width, height, fps, codecs).
     *
     * @return array{duration: float, width: int, height: int, fps: float, codec: string}
     */
    public function getMetadata(string $filePath): array;

    /**
     * Extract audio stream (MP3/WAV/AAC) from video for AI speech processing.
     */
    public function extractAudio(string $videoPath, string $outputPath): string;

    /**
     * Generate video thumbnail at specific timestamp.
     */
    public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): string;

    /**
     * Hardcode / burn captions (SRT or ASS) directly into MP4 video using FFmpeg.
     */
    public function burnCaptions(string $videoPath, string $subtitlesPath, string $outputPath, array $styleOptions = []): string;
}
