<?php

namespace App\Services\AI;

/**
 * Text-only clean-up of transcribed caption lines (punctuation, spacing, Unicode).
 * Implementations must never change timing, merge or split lines, or translate.
 */
interface CaptionRefinerInterface
{
    /**
     * @param  list<array{text: string, language: string, start?: float, end?: float}>  $lines
     * @param  string|null  $audioPath  the audio these lines were transcribed from (times relative to it):
     *                                  when given, the model listens and fixes misheard/missing words too
     * @return list<string> cleaned text, same length and order as $lines
     */
    public function refine(array $lines, string $language, ?string $audioPath = null): array;

    /** Model id used, for usage records; null when nothing was called. */
    public function model(): ?string;
}
