<?php

namespace App\Services\Caption;

/**
 * Writes English words that were spoken inside Sinhala speech in English letters,
 * e.g. "ෆෝන් එක" → "phone එක", "ටොයොටා ඇක්වා" → "Toyota Aqua".
 *
 * Deterministic and free (no AI call), so it works even when the AI review is busy.
 * Only whole words from a curated list (resources/captions/english-words.json) are
 * replaced; matching ignores ZWJ and surrounding punctuation, which is kept.
 */
class EnglishWords
{
    private const MAX_PHRASE = 3;

    /** @var array<string, string>|null normalised Sinhala phrase → English */
    private ?array $map = null;

    /**
     * @param  list<array{word?: string, text?: string, start: float, end: float}>  $words
     * @return array{text: string, words: list<array<string, mixed>>, changed: bool}
     */
    public function applyToLine(string $text, array $words = []): array
    {
        $tokens = preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $timed = $words !== [] && count($words) === count($tokens);
        $outTokens = [];
        $outWords = [];
        $changed = false;

        for ($i = 0, $n = count($tokens); $i < $n;) {
            [$length, $english] = $this->matchAt($tokens, $i);
            if ($english === null) {
                $outTokens[] = $tokens[$i];
                if ($timed) {
                    $outWords[] = $words[$i];
                }
                $i++;

                continue;
            }

            // Keep punctuation around the phrase: "(ෆෝන්," → "(phone,".
            preg_match('/^(\p{P}*)/u', $tokens[$i], $lead);
            preg_match('/(\p{P}*)$/u', $tokens[$i + $length - 1], $trail);
            $replacement = preg_split('/\s+/u', $english) ?: [$english];
            $replacement[0] = ($lead[1] ?? '').$replacement[0];
            $replacement[count($replacement) - 1] .= $trail[1] ?? '';
            array_push($outTokens, ...$replacement);

            if ($timed) {
                // The English words share the time of the Sinhala-spelled words they replace.
                $from = (float) $words[$i]['start'];
                $to = (float) $words[$i + $length - 1]['end'];
                $step = ($to - $from) / count($replacement);
                $key = isset($words[$i]['word']) ? 'word' : 'text';
                foreach ($replacement as $k => $token) {
                    $outWords[] = [$key => $token, 'start' => round($from + $k * $step, 3), 'end' => round($from + ($k + 1) * $step, 3)] + $words[$i];
                }
            }
            $changed = true;
            $i += $length;
        }

        return [
            'text' => $changed ? implode(' ', $outTokens) : $text,
            'words' => $timed ? $outWords : $words,
            'changed' => $changed,
        ];
    }

    public function apply(string $text): string
    {
        return $this->applyToLine($text)['text'];
    }

    /** @return array{0: int, 1: ?string} [tokens used, English] — longest phrase first */
    private function matchAt(array $tokens, int $i): array
    {
        $map = $this->map();
        for ($len = min(self::MAX_PHRASE, count($tokens) - $i); $len >= 1; $len--) {
            $phrase = implode(' ', array_map(fn ($t) => self::core($t), array_slice($tokens, $i, $len)));
            if (isset($map[$phrase])) {
                return [$len, $map[$phrase]];
            }
        }

        return [1, null];
    }

    /** A token without surrounding punctuation or ZWJ/ZWNJ, NFC-normalised. */
    public static function core(string $token): string
    {
        $token = preg_replace('/^\p{P}+|\p{P}+$/u', '', $token) ?? $token;
        $token = \Normalizer::normalize($token, \Normalizer::FORM_C) ?: $token;

        return str_replace(["\u{200D}", "\u{200C}"], '', $token);
    }

    /** @return array<string, string> */
    private function map(): array
    {
        if ($this->map !== null) {
            return $this->map;
        }
        $data = json_decode((string) file_get_contents(resource_path('captions/english-words.json')), true);
        $this->map = [];
        foreach ($data['words'] ?? [] as $english => $spellings) {
            foreach ($spellings as $spelling) {
                $key = implode(' ', array_map(fn ($t) => self::core($t), preg_split('/\s+/u', trim($spelling)) ?: []));
                $this->map[$key] = $english;
            }
        }

        return $this->map;
    }
}
