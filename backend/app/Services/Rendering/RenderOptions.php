<?php

namespace App\Services\Rendering;

final class RenderOptions
{
    public function __construct(
        public readonly string $inputPath,
        public readonly string $subtitlePath,
        public readonly string $outputPath,
        public readonly string $fontsDir,
        public readonly int $width,
        public readonly int $height,
        public readonly int $crf = 22,
        public readonly string $preset = 'medium',
        public readonly string $audioBitrate = '160k',
        public readonly float $durationSeconds = 0,
        /** Captions behind the person: greyscale mask frames (printf pattern), their rate and the source size they cover. */
        public readonly ?string $maskPattern = null,
        public readonly float $maskFps = 0,
        public readonly int $sourceWidth = 0,
        public readonly int $sourceHeight = 0,
        /** Drawn on top of the person (the watermark), when captions are behind them. */
        public readonly ?string $frontSubtitlePath = null,
    ) {
        if ($maskPattern !== null && ($maskFps <= 0 || $sourceWidth < 2 || $sourceHeight < 2)) {
            throw new \InvalidArgumentException('A subject mask needs its frame rate and the source size.');
        }
        if ($width < 16 || $height < 16 || $width % 2 || $height % 2) {
            throw new \InvalidArgumentException('Output size must be even and at least 16px.');
        }
        if (! preg_match('/^[a-z]+$/', $preset) || ! preg_match('/^\d{2,3}k$/', $audioBitrate) || $crf < 0 || $crf > 51) {
            throw new \InvalidArgumentException('Invalid encoder settings.');
        }
    }
}
