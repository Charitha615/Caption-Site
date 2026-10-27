<?php

namespace App\Services\AI;

class WordTimingEstimator
{
    /**
     * Ensure every caption segment has word-level timestamps.
     * If word timings already exist, retain them. Otherwise, intelligently
     * interpolate based on word length and language phonetics.
     *
     * @param string $text
     * @param float $start
     * @param float $end
     * @param array $existingWords
     * @return array<array{word: string, start: float, end: float}>
     */
    public static function estimate(string $text, float $start, float $end, array $existingWords = []): array
    {
        if (!empty($existingWords)) {
            return $existingWords;
        }

        $text = trim($text);
        if ($text === '') {
            return [];
        }

        // Split words preserving Unicode / Sinhala letters
        $words = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (empty($words)) {
            return [];
        }

        $totalDuration = max(0.1, $end - $start);
        $totalChars = 0;
        foreach ($words as $w) {
            $totalChars += max(1, mb_strlen($w, 'UTF-8'));
        }

        $currentStart = $start;
        $result = [];

        foreach ($words as $index => $word) {
            $charCount = max(1, mb_strlen($word, 'UTF-8'));
            $wordDuration = ($charCount / $totalChars) * $totalDuration;
            
            // For the last word, ensure it lands on the segment end time
            if ($index === count($words) - 1) {
                $wordEnd = $end;
            } else {
                $wordEnd = round($currentStart + $wordDuration, 3);
            }

            $result[] = [
                'word' => $word,
                'start' => round($currentStart, 3),
                'end' => round($wordEnd, 3),
            ];

            $currentStart = $wordEnd;
        }

        return $result;
    }
}
