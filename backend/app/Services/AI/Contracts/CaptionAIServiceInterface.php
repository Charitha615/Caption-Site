<?php

namespace App\Services\AI\Contracts;

use App\Models\MediaFile;
use App\Models\Project;

interface CaptionAIServiceInterface
{
    /**
     * Transcribe audio/video and generate timed caption segments.
     * Supports Sinhala ('si'), English ('en'), and multilingual.
     *
     * @return array{raw_text: string, words: array, captions: array<array{start_time: float, end_time: float, text: string}>}
     */
    public function generateCaptions(MediaFile $mediaFile, string $targetLanguage = 'si'): array;

    /**
     * Translate caption segments between languages (e.g. Sinhala to English or vice-versa).
     *
     * @param array<array{start_time: float, end_time: float, text: string}> $captions
     * @return array<array{start_time: float, end_time: float, text: string}>
     */
    public function translateCaptions(array $captions, string $sourceLanguage, string $targetLanguage): array;
}
