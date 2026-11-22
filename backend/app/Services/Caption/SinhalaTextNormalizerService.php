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

        // Repair missing ZWJ on rakaranshaya: [ක-ෆ]්(?!‍)ර -> [ක-ෆ]්‍ර
        $text = preg_replace('/([\x{0D9A}-\x{0DC6}])\x{0DCA}(?!\x{200D})\x{0DBB}/u', '$1'."\u{0DCA}\u{200D}\u{0DBB}", $text) ?? $text;

        // Repair missing ZWJ on yansaya: [ක-ෆ]්(?!‍)ය -> [ක-ෆ]්‍ය
        $text = preg_replace('/([\x{0D9A}-\x{0DC6}])\x{0DCA}(?!\x{200D})\x{0DBA}/u', '$1'."\u{0DCA}\u{200D}\u{0DBA}", $text) ?? $text;

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
