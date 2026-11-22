<?php

namespace App\Services\Caption;

use App\Services\AI\CaptionLineBuilder;

/**
 * Lines up a user-provided script with the speech timings of an AI transcript.
 *
 * Every script word becomes a caption word. Words are matched to transcript words by how
 * they sound (Sinhala is romanised, so "ටොයොටා" ≈ "Toyota" and "ට්‍රැෆික්" ≈ "traffic")
 * using a global sequence alignment that tolerates missing, extra and misspelled words.
 * Matched words take the transcript word's timing; words the AI missed are placed in the
 * gap between their neighbours; words the AI invented are ignored. The result is grouped
 * into caption lines by CaptionLineBuilder (pauses, sentence ends, line length).
 */
class ScriptAligner
{
    private const MATCH_THRESHOLD = 0.55;

    private const GAP = -0.7;

    private const MISMATCH = -1.0;

    private const BAND = 120;

    /** Sinhala consonants → Latin sound. */
    private const CONSONANTS = [
        'ක' => 'k', 'ඛ' => 'k', 'ග' => 'g', 'ඝ' => 'g', 'ඞ' => 'n', 'ඟ' => 'ng', 'ච' => 'ch', 'ඡ' => 'ch',
        'ජ' => 'j', 'ඣ' => 'j', 'ඤ' => 'n', 'ඥ' => 'gn', 'ට' => 't', 'ඨ' => 't', 'ඩ' => 'd', 'ඪ' => 'd',
        'ණ' => 'n', 'ඬ' => 'nd', 'ත' => 't', 'ථ' => 't', 'ද' => 'd', 'ධ' => 'd', 'න' => 'n', 'ඳ' => 'nd',
        'ප' => 'p', 'ඵ' => 'p', 'බ' => 'b', 'භ' => 'b', 'ම' => 'm', 'ඹ' => 'mb', 'ය' => 'y', 'ර' => 'r',
        'ල' => 'l', 'ව' => 'v', 'ශ' => 'sh', 'ෂ' => 'sh', 'ස' => 's', 'හ' => 'h', 'ළ' => 'l', 'ෆ' => 'f',
    ];

    private const VOWELS = [
        'අ' => 'a', 'ආ' => 'a', 'ඇ' => 'a', 'ඈ' => 'a', 'ඉ' => 'i', 'ඊ' => 'i', 'උ' => 'u', 'ඌ' => 'u',
        'ඍ' => 'ru', 'එ' => 'e', 'ඒ' => 'e', 'ඓ' => 'ai', 'ඔ' => 'o', 'ඕ' => 'o', 'ඖ' => 'au',
    ];

    private const SIGNS = [
        'ා' => 'a', 'ැ' => 'a', 'ෑ' => 'a', 'ි' => 'i', 'ී' => 'i', 'ු' => 'u', 'ූ' => 'u', 'ෘ' => 'ru',
        'ෙ' => 'e', 'ේ' => 'e', 'ෛ' => 'ai', 'ො' => 'o', 'ෝ' => 'o', 'ෞ' => 'au', '්' => '', 'ං' => 'ng', 'ඃ' => 'h',
    ];

    /**
     * @param  list<array{word: string, start: float, end: float}>  $speech  transcript words in time order
     * @return array{segments: list<array<string, mixed>>, stats: array{script_words: int, matched: int, placed: int}}
     */
    public function align(string $script, array $speech, float $duration, string $language): array
    {
        $words = self::tokenize($script);
        if ($words === []) {
            return ['segments' => [], 'stats' => ['script_words' => 0, 'matched' => 0, 'placed' => 0]];
        }

        $scriptKeys = array_map(fn ($w) => self::key($w), $words);
        $speechKeys = array_map(fn ($w) => self::key((string) $w['word']), $speech);
        $pairs = $this->alignSequences($scriptKeys, $speechKeys);

        $timed = [];
        foreach ($words as $i => $word) {
            $j = $pairs[$i] ?? null;
            $timed[$i] = ['word' => $word, 'start' => $j !== null ? (float) $speech[$j]['start'] : null, 'end' => $j !== null ? (float) $speech[$j]['end'] : null];
        }
        $matched = count(array_filter($timed, fn ($w) => $w['start'] !== null));
        $timed = $this->fillGaps($timed, $duration);

        return [
            'segments' => CaptionLineBuilder::build($timed, $language),
            'stats' => ['script_words' => count($words), 'matched' => $matched, 'placed' => count($words) - $matched],
        ];
    }

    /** @return list<string> */
    public static function tokenize(string $script): array
    {
        $text = \Normalizer::normalize(trim($script), \Normalizer::FORM_C) ?: trim($script);

        return preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }

    /** A rough, script-independent sound key: Sinhala romanised, Latin simplified. */
    public static function key(string $word): string
    {
        $word = mb_strtolower($word, 'UTF-8');
        $chars = preg_split('//u', $word, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $out = '';
        $count = count($chars);
        for ($i = 0; $i < $count; $i++) {
            $c = $chars[$i];
            if (isset(self::CONSONANTS[$c])) {
                $out .= self::CONSONANTS[$c];
                $next = $chars[$i + 1] ?? '';
                // Inherent "a" unless a vowel sign or virama follows.
                if (! isset(self::SIGNS[$next])) {
                    $out .= 'a';
                }
            } elseif (isset(self::VOWELS[$c])) {
                $out .= self::VOWELS[$c];
            } elseif (isset(self::SIGNS[$c])) {
                $out .= self::SIGNS[$c];
            } elseif (preg_match('/[a-z0-9]/', $c)) {
                $out .= $c;
            }
            // ZWJ, punctuation and everything else carry no sound.
        }

        $out = strtr($out, ['ph' => 'f', 'ck' => 'k', 'qu' => 'kv', 'w' => 'v', 'q' => 'k', 'x' => 'ks', 'z' => 's', 'c' => 'k']);
        $out = str_replace('kh', 'ch', $out); // "ch" from c+h survived as "kh"

        return preg_replace('/(.)\1+/', '$1', $out) ?? $out; // collapse doubled letters
    }

    public static function similarity(string $a, string $b): float
    {
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }

        return 1 - levenshtein($a, $b) / max(strlen($a), strlen($b));
    }

    /**
     * Banded global alignment (Needleman-Wunsch). Returns script index → speech index.
     *
     * @param  list<string>  $a  script keys
     * @param  list<string>  $b  speech keys
     * @return array<int, int>
     */
    private function alignSequences(array $a, array $b): array
    {
        $n = count($a);
        $m = count($b);
        if ($m === 0) {
            return [];
        }
        $band = max(self::BAND, abs($n - $m) + self::BAND);
        $diag = fn (int $i) => (int) round($i * $m / max(1, $n));

        $score = [0 => [0 => 0.0]];
        $move = [];
        for ($j = 1; $j <= min($m, $band); $j++) {
            $score[0][$j] = $j * self::GAP;
            $move[0][$j] = 'L';
        }
        for ($i = 1; $i <= $n; $i++) {
            $lo = max(0, $diag($i) - $band);
            $hi = min($m, $diag($i) + $band);
            $score[$i] = [];
            for ($j = $lo; $j <= $hi; $j++) {
                if ($j === 0) {
                    $score[$i][0] = $i * self::GAP;
                    $move[$i][0] = 'U';

                    continue;
                }
                $best = -INF;
                $dir = 'U';
                if (isset($score[$i - 1][$j - 1])) {
                    $sim = self::similarity($a[$i - 1], $b[$j - 1]);
                    $s = $score[$i - 1][$j - 1] + ($sim >= self::MATCH_THRESHOLD ? 2 * $sim : self::MISMATCH);
                    if ($s > $best) {
                        [$best, $dir] = [$s, $sim >= self::MATCH_THRESHOLD ? 'M' : 'X'];
                    }
                }
                if (isset($score[$i - 1][$j]) && ($s = $score[$i - 1][$j] + self::GAP) > $best) {
                    [$best, $dir] = [$s, 'U'];
                }
                if (isset($score[$i][$j - 1]) && ($s = $score[$i][$j - 1] + self::GAP) > $best) {
                    [$best, $dir] = [$s, 'L'];
                }
                $score[$i][$j] = $best;
                $move[$i][$j] = $dir;
            }
            unset($score[$i - 2]); // keep memory to two rows of scores
        }

        // Trace back from the best end cell on the last row (script may end before the speech).
        $i = $n;
        $j = array_search(max($score[$n]), $score[$n], true);
        $pairs = [];
        while ($i > 0 && $j > 0) {
            $dir = $move[$i][$j] ?? 'U';
            if ($dir === 'M' || $dir === 'X') {
                if ($dir === 'M') {
                    $pairs[$i - 1] = $j - 1;
                }
                $i--;
                $j--;
            } elseif ($dir === 'U') {
                $i--;
            } else {
                $j--;
            }
        }

        return $pairs;
    }

    /**
     * Gives every unmatched word a time inside the gap between its matched neighbours,
     * shared by word length, keeping all words in order.
     *
     * @param  list<array{word: string, start: ?float, end: ?float}>  $words
     * @return list<array{word: string, start: float, end: float}>
     */
    private function fillGaps(array $words, float $duration): array
    {
        $n = count($words);
        $i = 0;
        while ($i < $n) {
            if ($words[$i]['start'] !== null) {
                $i++;

                continue;
            }
            $runStart = $i;
            while ($i < $n && $words[$i]['start'] === null) {
                $i++;
            }
            $from = $runStart > 0 ? (float) $words[$runStart - 1]['end'] : 0.0;
            $to = $i < $n ? (float) $words[$i]['start'] : max($from + 0.4 * ($i - $runStart), $duration);
            if ($to - $from < 0.15 * ($i - $runStart)) {
                $to = $from + 0.15 * ($i - $runStart); // squeezed: give each word a minimal slot
            }
            $weights = array_map(fn ($k) => max(1, mb_strlen($words[$k]['word'])), range($runStart, $i - 1));
            $total = array_sum($weights);
            $t = $from;
            foreach (range($runStart, $i - 1) as $n2 => $k) {
                $len = ($to - $from) * $weights[$n2] / $total;
                $words[$k]['start'] = round($t, 3);
                $words[$k]['end'] = round($t + $len, 3);
                $t += $len;
            }
        }

        // Keep time monotonic (matched words can overlap after interpolation).
        $prevEnd = 0.0;
        foreach ($words as &$w) {
            $w['start'] = max((float) $w['start'], $prevEnd);
            $w['end'] = max((float) $w['end'], $w['start'] + 0.05);
            $prevEnd = $w['end'];
        }
        unset($w);

        return $words;
    }
}
