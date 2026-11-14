<?php

namespace App\Services\AI;

/**
 * Groups word-level timestamps (from a transcription model) into readable caption lines.
 *
 * A new line starts when the current one would exceed MAX_CHARS / MAX_WORDS / MAX_SECONDS,
 * after a pause, when the speaker changes, or after sentence-ending punctuation.
 * Word timings are kept exactly as transcribed.
 */
class CaptionLineBuilder
{
    public const MAX_CHARS = 42;

    public const MAX_WORDS = 8;

    public const MAX_SECONDS = 6.0;

    public const PAUSE_SECONDS = 0.7;

    /**
     * @param  list<array{word: string, start: float, end: float, speaker?: ?string}>  $words
     * @return list<array{text: string, language: string, start: float, end: float, speaker: ?string, words: list<array{word: string, start: float, end: float, speaker?: ?string}>}>
     */
    public static function build(array $words, string $defaultLanguage): array
    {
        $lines = [];
        $current = [];

        $flush = function () use (&$current, &$lines, $defaultLanguage) {
            if (! $current) {
                return;
            }
            $text = implode(' ', array_column($current, 'word'));
            $lines[] = [
                'text' => $text,
                'language' => self::languageOf($text, $defaultLanguage),
                'start' => $current[0]['start'],
                'end' => end($current)['end'],
                'speaker' => $current[0]['speaker'] ?? null,
                'words' => $current,
            ];
            $current = [];
        };

        foreach ($words as $w) {
            if ($current) {
                $last = end($current);
                $text = implode(' ', array_column($current, 'word')).' '.$w['word'];
                $breakBefore = mb_strlen($text) > self::MAX_CHARS
                    || count($current) >= self::MAX_WORDS
                    || $w['end'] - $current[0]['start'] > self::MAX_SECONDS
                    || $w['start'] - $last['end'] >= self::PAUSE_SECONDS
                    || (($w['speaker'] ?? null) !== ($last['speaker'] ?? null))
                    || (count($current) >= 3 && preg_match('/[.!?।…]$/u', $last['word']));
                if ($breakBefore) {
                    $flush();
                }
            }
            $current[] = $w;
        }
        $flush();

        return $lines;
    }

    /** 'si' when the line contains Sinhala script, else 'en' (mixed lines count as Sinhala). */
    public static function languageOf(string $text, string $fallback): string
    {
        if (preg_match('/[\x{0D80}-\x{0DFF}]/u', $text)) {
            return 'si';
        }
        if (preg_match('/[A-Za-z]/', $text)) {
            return 'en';
        }

        return in_array($fallback, ['si', 'en'], true) ? $fallback : 'si';
    }
}
