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
    ) {
        if ($width < 16 || $height < 16 || $width % 2 || $height % 2) {
            throw new \InvalidArgumentException('Output size must be even and at least 16px.');
        }
        if (!preg_match('/^[a-z]+$/', $preset) || !preg_match('/^\d{2,3}k$/', $audioBitrate) || $crf < 0 || $crf > 51) {
            throw new \InvalidArgumentException('Invalid encoder settings.');
        }
    }
}
