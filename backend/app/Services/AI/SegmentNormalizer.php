<?php

namespace App\Services\AI;

/** Turns loosely-shaped provider output into clean, ordered, non-overlapping caption segments. */
class SegmentNormalizer
{
    public const MAX_SEGMENT_CHARS = 500;

    /**
     * @return list<array{text: string, language: string, start: float, end: float, words: list<array{word: string, start: float, end: float}>}>
     */
    public static function normalize(array $rawSegments, string $defaultLang, ?float $duration = null): array
    {
        $fallbackLang = $defaultLang !== 'auto' ? $defaultLang : 'si';
        $segments = [];

        foreach ($rawSegments as $seg) {
            if (! is_array($seg)) {
                continue;
            }
            $text = trim(preg_replace('/\s+/u', ' ', (string) ($seg['text'] ?? '')) ?? '');
            if ($text === '') {
                continue;
            }
            $text = mb_substr($text, 0, self::MAX_SEGMENT_CHARS);

            $start = max(0.0, (float) ($seg['start'] ?? $seg['start_time'] ?? 0.0));
            $end = (float) ($seg['end'] ?? $seg['end_time'] ?? ($start + 2.5));
            if ($end <= $start) {
                $end = $start + 1.5;
            }
            if ($duration && $duration > 0) {
                if ($start >= $duration) {
                    continue; // hallucinated beyond the end of the media
                }
                $end = min($end, $duration);
            }

            $lang = in_array($seg['language'] ?? null, ['si', 'en'], true) ? $seg['language'] : $fallbackLang;
            $words = self::cleanWords($seg['words'] ?? [], $start, $end);

            $segments[] = [
                'text' => $text,
                'language' => $lang,
                'start' => round($start, 3),
                'end' => round($end, 3),
                'words' => WordTimingEstimator::estimate($text, $start, $end, $words),
            ];
        }

        usort($segments, fn ($a, $b) => $a['start'] <=> $b['start']);

        // Trim overlaps so the timeline never starts with stacked captions.
        for ($i = 1, $n = count($segments); $i < $n; $i++) {
            if ($segments[$i]['start'] < $segments[$i - 1]['end']) {
                $segments[$i - 1]['end'] = max($segments[$i - 1]['start'] + 0.1, $segments[$i]['start']);
            }
        }

        return $segments;
    }

    private static function cleanWords(mixed $words, float $start, float $end): array
    {
        if (! is_array($words)) {
            return [];
        }
        $clean = [];
        foreach ($words as $w) {
            if (! is_array($w) || trim((string) ($w['word'] ?? '')) === '') {
                continue;
            }
            $ws = (float) ($w['start'] ?? $start);
            $we = (float) ($w['end'] ?? $ws);
            $clean[] = [
                'word' => trim((string) $w['word']),
                'start' => round(min(max($ws, $start), $end), 3),
                'end' => round(min(max($we, $ws), $end), 3),
            ];
        }

        return $clean;
    }
}
