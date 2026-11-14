<?php

namespace App\Services\Caption;

/**
 * Repairs Sinhala text in which a speech model wrote some syllables in another Indic
 * script (e.g. "ලංਕාවේ" with Gurmukhi ਕ, "මොకද" with Telugu క, "ගിය" with Malayalam ി).
 *
 * Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam
 * share one ISCII-derived layout (same offset within each 128-code-point block), so every
 * letter maps to the Sinhala letter with the same sound. Only text that already contains
 * Sinhala is touched — genuine Hindi/Tamil text elsewhere is left alone.
 */
class SinhalaScriptRepair
{
    /** First code point of each Indic block that shares the ISCII layout. */
    private const BLOCKS = [0x0900, 0x0980, 0x0A00, 0x0A80, 0x0B00, 0x0B80, 0x0C00, 0x0C80, 0x0D00];

    /** ISCII offset → Sinhala code point(s). */
    private const MAP = [
        // signs
        0x01 => "\u{0D82}", 0x02 => "\u{0D82}", 0x03 => "\u{0D83}",
        // independent vowels
        0x05 => "\u{0D85}", 0x06 => "\u{0D86}", 0x07 => "\u{0D89}", 0x08 => "\u{0D8A}",
        0x09 => "\u{0D8B}", 0x0A => "\u{0D8C}", 0x0B => "\u{0D8D}", 0x0C => "\u{0D8F}",
        0x0D => "\u{0D91}", 0x0E => "\u{0D91}", 0x0F => "\u{0D92}", 0x10 => "\u{0D93}",
        0x11 => "\u{0D94}", 0x12 => "\u{0D94}", 0x13 => "\u{0D95}", 0x14 => "\u{0D96}",
        // consonants
        0x15 => "\u{0D9A}", 0x16 => "\u{0D9B}", 0x17 => "\u{0D9C}", 0x18 => "\u{0D9D}", 0x19 => "\u{0D9E}",
        0x1A => "\u{0DA0}", 0x1B => "\u{0DA1}", 0x1C => "\u{0DA2}", 0x1D => "\u{0DA3}", 0x1E => "\u{0DA4}",
        0x1F => "\u{0DA7}", 0x20 => "\u{0DA8}", 0x21 => "\u{0DA9}", 0x22 => "\u{0DAA}", 0x23 => "\u{0DAB}",
        0x24 => "\u{0DAD}", 0x25 => "\u{0DAE}", 0x26 => "\u{0DAF}", 0x27 => "\u{0DB0}", 0x28 => "\u{0DB1}",
        0x29 => "\u{0DB1}", 0x2A => "\u{0DB4}", 0x2B => "\u{0DB5}", 0x2C => "\u{0DB6}", 0x2D => "\u{0DB7}",
        0x2E => "\u{0DB8}", 0x2F => "\u{0DBA}", 0x30 => "\u{0DBB}", 0x31 => "\u{0DBB}", 0x32 => "\u{0DBD}",
        0x33 => "\u{0DC5}", 0x34 => "\u{0DC5}", 0x35 => "\u{0DC0}", 0x36 => "\u{0DC1}", 0x37 => "\u{0DC2}",
        0x38 => "\u{0DC3}", 0x39 => "\u{0DC4}",
        // dependent vowel signs
        0x3E => "\u{0DCF}", 0x3F => "\u{0DD2}", 0x40 => "\u{0DD3}", 0x41 => "\u{0DD4}", 0x42 => "\u{0DD6}",
        0x43 => "\u{0DD8}", 0x44 => "\u{0DF2}", 0x45 => "\u{0DD9}", 0x46 => "\u{0DD9}", 0x47 => "\u{0DDA}",
        0x48 => "\u{0DDB}", 0x49 => "\u{0DDC}", 0x4A => "\u{0DDC}", 0x4B => "\u{0DDD}", 0x4C => "\u{0DDE}",
        // virama
        0x4D => "\u{0DCA}",
        // length marks (Malayalam/Tamil au length mark etc.) → dropped
        0x57 => '', 0x55 => '', 0x56 => '',
    ];

    /** Malayalam chillu letters (consonant without vowel). */
    private const CHILLU = [
        0x0D7A => "\u{0DAB}\u{0DCA}", 0x0D7B => "\u{0DB1}\u{0DCA}", 0x0D7C => "\u{0DBB}\u{0DCA}",
        0x0D7D => "\u{0DBD}\u{0DCA}", 0x0D7E => "\u{0DC5}\u{0DCA}", 0x0D7F => "\u{0D9A}\u{0DCA}",
    ];

    /** Characters from other Indic scripts (Devanagari … Malayalam), plus stray look-alikes seen in transcripts. */
    private const FOREIGN = '/[\x{0900}-\x{0D7F}\x{ABE3}-\x{ABEA}\x{0628}]/u';

    /** Look-alike letters outside the ISCII blocks (Meetei Mayek vowel signs, Arabic). */
    private const EXTRA = [
        0xABE3 => "\u{0DDD}", 0xABE4 => "\u{0DD2}", 0xABE5 => "\u{0DD4}", 0xABE6 => "\u{0DDA}",
        0xABE7 => "\u{0DDD}", 0xABE8 => "\u{0DD4}", 0xABE9 => "\u{0DDB}", 0xABEA => "\u{0DCA}",
        0x0628 => "\u{0DB6}",
    ];

    /** Virama in each ISCII block (offset 0x4D), and RA / YA (offsets 0x30 / 0x2F). */
    private const VIRAMA = '[\x{094D}\x{09CD}\x{0A4D}\x{0ACD}\x{0B4D}\x{0BCD}\x{0C4D}\x{0CCD}\x{0D4D}\x{0DCA}]';

    public function needsRepair(string $text): bool
    {
        return preg_match('/[\x{0D80}-\x{0DFF}]/u', $text) === 1 && preg_match(self::FOREIGN, $text) === 1;
    }

    /** Returns the text with foreign-script letters converted to Sinhala (NFC). */
    public function repair(string $text): string
    {
        return $this->needsRepair($text) ? $this->convert($text) : $text;
    }

    /** Converts every foreign Indic letter to its Sinhala counterpart. */
    private function convert(string $text): string
    {
        // Malayalam "റ്റ" is pronounced ṭṭa → Sinhala ට.
        $text = str_replace("\u{0D31}\u{0D4D}\u{0D31}", "\u{0DA7}", $text);
        // Consonant + virama + RA/YA written in a foreign script → Sinhala rakaransaya / yansaya (needs ZWJ).
        $text = preg_replace('/'.self::VIRAMA.'([\x{0930}\x{09B0}\x{0A30}\x{0AB0}\x{0B30}\x{0BB0}\x{0C30}\x{0CB0}\x{0D30}])(?=[\x{0900}-\x{0DFF}]|$|\s|[[:punct:]])/u', "\u{0DCA}\u{200D}\u{0DBB}", $text) ?? $text;
        $text = preg_replace('/'.self::VIRAMA.'([\x{092F}\x{09AF}\x{0A2F}\x{0AAF}\x{0B2F}\x{0BAF}\x{0C2F}\x{0CAF}\x{0D2F}])/u', "\u{0DCA}\u{200D}\u{0DBA}", $text) ?? $text;

        $out = preg_replace_callback(self::FOREIGN, function (array $m): string {
            $cp = mb_ord($m[0], 'UTF-8');
            if (isset(self::CHILLU[$cp])) {
                return self::CHILLU[$cp];
            }
            if (isset(self::EXTRA[$cp])) {
                return self::EXTRA[$cp];
            }
            $offset = ($cp - 0x0900) % 0x80;

            return self::MAP[$offset] ?? $m[0];
        }, $text) ?? $text;

        return \Normalizer::normalize($out, \Normalizer::FORM_C) ?: $out;
    }

    /**
     * Repairs caption segments in place (text and word texts). Timings are untouched.
     *
     * @param  list<array<string, mixed>>  $segments
     * @return array{0: list<array<string, mixed>>, 1: int} segments and number of lines changed
     */
    public function repairSegments(array $segments): array
    {
        $changed = 0;
        foreach ($segments as &$seg) {
            $fixed = $this->repair((string) $seg['text']);
            $changedLine = $fixed !== $seg['text'];
            if ($changedLine) {
                $seg['text'] = $fixed;
                $changed++;
            }
            foreach ($seg['words'] ?? [] as $i => $w) {
                $key = isset($w['word']) ? 'word' : 'text';
                if (isset($w[$key])) {
                    // A word may be entirely in the wrong script; judge it by its (Sinhala) line.
                    $seg['words'][$i][$key] = $changedLine ? $this->convert((string) $w[$key]) : $w[$key];
                }
            }
        }
        unset($seg);

        return [$segments, $changed];
    }
}
