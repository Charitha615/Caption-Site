<?php

namespace App\Services\Caption;

class SinhalaTextNormalizerService
{
    /**
     * Normalize Sinhala Unicode characters and conjuncts.
     */
    public function normalize(string $text): string
    {
        // Trim leading and trailing whitespace
        $text = trim($text);

        // Normalize multiple spaces into single space
        $text = preg_replace('/[ \t]+/u', ' ', $text);

        // Ensure proper line endings
        $text = str_replace(["\r\n", "\r"], "\n", $text);

        return $text;
    }

    /**
     * Check if a string contains Sinhala Unicode characters (U+0D80 to U+0DFF).
     */
    public function containsSinhala(string $text): bool
    {
        return (bool) preg_match('/[\x{0D80}-\x{0DFF}]/u', $text);
    }

    /**
     * Count words properly for Sinhala and English mixed text.
     */
    public function wordCount(string $text): int
    {
        $normalized = $this->normalize($text);
        if (empty($normalized)) {
            return 0;
        }

        $words = preg_split('/\s+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY);
        return count($words);
    }
}
