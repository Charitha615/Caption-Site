<?php

namespace App\Services\Rendering;

use App\Services\Caption\CaptionStyleNormalizer;

/**
 * CaptionRenderer: converts structured, styled captions into an ASS (Advanced
 * SubStation Alpha) script that FFmpeg's libass filter burns into the video.
 *
 * It mirrors the browser preview (frontend CaptionBox / captionStyle.ts):
 *  - Style units are 1080p reference units, scaled by min(W, H) / 1080.
 *  - Each caption is drawn in up to three layers, like the preview's layered DOM:
 *      0 background box (BorderStyle 4: one padded box per caption, like the preview)
 *      1 shadow (offset + gaussian blur of the outlined text)
 *      2 text with an outside stroke
 *  - Mixed Sinhala/English text is split into script runs, each switching to its
 *    own font (\fn) at a size corrected for that font's metrics, matching the CSS
 *    stack "<English font>, <Sinhala font>". libass shapes runs with HarfBuzz, so
 *    Sinhala conjuncts (ශ්‍රී, ක්‍ෂ) render correctly.
 *  - Timed animations become sequences of events: karaoke/word-box per word,
 *    typewriter per grapheme (layout stays fixed because hidden text is kept, as
 *    in the preview).
 *
 * Requires libass ≥ 0.17 (BorderStyle 4). Known differences from the preview
 * (libass limits): box corners are square (border radius is not rendered) and
 * custom line height is not applied.
 */
class AssCaptionRenderer
{
    protected const SINHALA_RE = '/[\x{0D80}-\x{0DFF}]/u';

    protected const ZWJ = "\u{200D}";

    protected const AL_LAKUNA = "\u{0DCA}";

    protected const ANCHORS = [
        'top-left' => 7, 'top-center' => 8, 'top-right' => 9,
        'mid-left' => 4, 'center' => 5, 'mid-right' => 6,
        'bottom-left' => 1, 'bottom-center' => 2, 'bottom-right' => 3,
    ];

    public function __construct(
        protected CaptionStyleNormalizer $normalizer,
        protected FontRegistry $fonts,
    ) {}

    /**
     * @param  array<int, array{start: float, end: float, text: string, language?: string, words?: ?array, style_override?: ?array}>  $captions
     * @param  array  $style  global (project) style
     */
    public function render(array $captions, array $style, int $width, int $height): string
    {
        $global = $this->normalizer->normalize($style);
        $scale = min($width, $height) / 1080;

        $lines = [];
        foreach ($captions as $caption) {
            $text = $this->cleanText((string) ($caption['text'] ?? ''));
            $start = (float) ($caption['start'] ?? 0);
            $end = (float) ($caption['end'] ?? 0);
            if ($text === '' || $end <= $start) {
                continue;
            }
            $resolved = $this->normalizer->resolve($global, $caption['style_override'] ?? null);
            array_push($lines, ...$this->captionEvents($text, $start, $end, $caption['words'] ?? null, $resolved, $width, $height, $scale));
        }

        return $this->header($width, $height, $global).implode("\n", $lines)."\n";
    }

    /* ------------------------------------------------------------------ events */

    protected function captionEvents(string $text, float $start, float $end, ?array $words, array $s, int $w, int $h, float $scale): array
    {
        $fontPx = $s['fontSize'] * $scale;
        $padX = $s['padding'] * $scale;
        $padY = $s['padding'] * 0.6 * $scale;
        $stroke = $s['outlineWidth'] * $scale;

        // Anchor point of the *outer* box (incl. padding), like the preview; libass anchors the text.
        [$vertical, $horizontal] = $this->anchorParts($s['alignMatrix']);
        $x = $s['positionX'] / 100 * $w + match ($horizontal) {
            'left' => $padX, 'right' => -$padX, default => 0
        };
        $y = $s['positionY'] / 100 * $h + match ($vertical) {
            'top' => $padY, 'bottom' => -$padY, default => 0
        };

        // Wrapping width = maxWidth% of the frame minus padding, centred on the anchor.
        $wrapWidth = max($fontPx * 2, $s['maxWidth'] / 100 * $w - 2 * $padX);
        $margin = (int) max(0, round(($w - $wrapWidth) / 2));

        $common = [
            'an' => self::ANCHORS[$s['alignMatrix']] ?? 2,
            'x' => $x,
            'y' => $y,
            'margin' => $margin,
            'entrance' => $this->entrance($s['animation'], $fontPx),
        ];

        $base = sprintf('\fsp%s', $this->num($s['letterSpacing'] * $scale));
        $runs = $this->scriptRuns($text);
        $events = [];

        // Layer 0 — background box.
        if ($s['backgroundOpacity'] > 0) {
            // BorderStyle 4 (libass ≥ 0.17): one box around the whole event, like the preview's box.
            $tags = $base.sprintf(
                '\bord0\xbord%s\ybord%s\shad0\1a&HFF&\3a&HFF&\4c%s\4a%s',
                $this->num($padX), $this->num($padY), $this->color($s['backgroundColor']), $this->alpha($s['backgroundOpacity']),
            );
            $events[] = $this->dialogue(0, 'Box', $start, $end, $common, $tags, $this->markup($runs, $s, $scale));
        }

        // Layer 1 — shadow (blurred copy of the outlined text, offset).
        $hasShadow = $s['shadowOpacity'] > 0 && ($s['shadowBlur'] > 0 || $s['shadowOffsetX'] != 0 || $s['shadowOffsetY'] != 0);
        $shadowCommon = $common;
        $shadowCommon['x'] += $s['shadowOffsetX'] * $scale;
        $shadowCommon['y'] += $s['shadowOffsetY'] * $scale;
        $shadowTags = $base.sprintf(
            '\1c%1$s\3c%1$s\1a%2$s\3a%2$s\bord%3$s\shad0\blur%4$s',
            $this->color($s['shadowColor']), $this->alpha($s['shadowOpacity']), $this->num($stroke), $this->num($s['shadowBlur'] * $scale / 2),
        );

        // Layer 2 — text with outside stroke.
        $textTags = $base.sprintf(
            '\1c%s\1a&H00&\3c%s\3a&H00&\bord%s\shad0',
            $this->color($s['textColor']), $this->color($s['outlineColor']), $this->num($stroke),
        );

        $frames = match ($s['animation']) {
            'karaoke', 'highlight' => $this->wordFrames($text, $start, $end, $words),
            'typewriter' => $this->typewriterFrames($text, $start, $end),
            default => [['start' => $start, 'end' => $end, 'word' => -1, 'visible' => null]],
        };

        // Spoken word: optional zoom (\fscx/\fscy) — reset to 100 for the other words.
        $zoom = (int) ($s['activeWordScale'] ?? 100);
        $zoomOn = $zoom !== 100 ? sprintf('\fscx%1$d\fscy%1$d', $zoom) : '';
        $zoomOff = $zoom !== 100 ? '\fscx100\fscy100' : '';

        foreach ($frames as $i => $f) {
            $entrance = $i === 0;
            if ($hasShadow) {
                $markup = match (true) {
                    $f['visible'] !== null => $this->typewriterMarkup($text, $f['visible'], $s, $scale),
                    $f['word'] >= 0 && $zoomOn !== '' => $this->wordMarkup($text, $f['word'], $s, $scale, $zoomOn, $zoomOff),
                    default => $this->markup($runs, $s, $scale),
                };
                $events[] = $this->dialogue(1, 'Text', $f['start'], $f['end'], $shadowCommon, $shadowTags, $markup, $entrance);
            }
            $markup = match (true) {
                $f['visible'] !== null => $this->typewriterMarkup($text, $f['visible'], $s, $scale),
                $f['word'] >= 0 && $s['animation'] === 'karaoke' => $this->wordMarkup($text, $f['word'], $s, $scale, sprintf('\1c%s', $this->color($s['highlightColor'])).$zoomOn, sprintf('\1c%s', $this->color($s['textColor'])).$zoomOff),
                $f['word'] >= 0 && $s['animation'] === 'highlight' => $this->wordMarkup($text, $f['word'], $s, $scale, sprintf('\1c%s\bord0', $this->color($s['highlightTextColor'] ?? '#000000')).$zoomOn, sprintf('\1c%s\bord%s', $this->color($s['textColor']), $this->num($stroke)).$zoomOff),
                default => $this->markup($runs, $s, $scale),
            };
            if ($f['word'] >= 0 && $s['animation'] === 'highlight') {
                // Word box: a Box-style event where only the active word's box is opaque.
                $boxMarkup = $this->wordMarkup($text, $f['word'], $s, $scale, '\3a&H00&'.$zoomOn, '\3a&HFF&'.$zoomOff);
                $hlTags = $base.sprintf('\bord0\xbord%1$s\ybord%2$s\shad0\1a&HFF&\3c%3$s\3a&HFF&\4a&HFF&', $this->num(0.14 * $fontPx), $this->num(0.08 * $fontPx), $this->color($s['highlightColor']));
                $events[] = $this->dialogue(1, 'WordBox', $f['start'], $f['end'], $common, $hlTags, $boxMarkup, false);
            }
            $events[] = $this->dialogue(2, 'Text', $f['start'], $f['end'], $common, $textTags, $markup, $entrance);
        }

        return $events;
    }

    protected function dialogue(int $layer, string $style, float $start, float $end, array $c, string $tags, string $text, bool $withEntrance = true): string
    {
        $entrance = $withEntrance ? $c['entrance'] : ['tags' => '', 'dy' => 0];
        $pos = $entrance['dy'] != 0
            ? sprintf('\move(%s,%s,%s,%s,0,%d)', $this->num($c['x']), $this->num($c['y'] + $entrance['dy']), $this->num($c['x']), $this->num($c['y']), $entrance['moveMs'])
            : sprintf('\pos(%s,%s)', $this->num($c['x']), $this->num($c['y']));

        return sprintf(
            'Dialogue: %d,%s,%s,%s,,%04d,%04d,0000,,{\an%d%s%s%s}%s',
            $layer, $this->time($start), $this->time($end), $style, $c['margin'], $c['margin'],
            $c['an'], $pos, $entrance['tags'], $tags, $text,
        );
    }

    /** Entrance animations equivalent to the preview's CSS keyframes. */
    protected function entrance(string $animation, float $fontPx): array
    {
        return match ($animation) {
            'fade' => ['tags' => '\fad(280,0)', 'dy' => 0],
            'pop' => ['tags' => '\fad(120,0)\fscx60\fscy60\t(0,340,\fscx100\fscy100)', 'dy' => 0],
            'bounce' => ['tags' => '\fad(160,0)', 'dy' => -0.6 * $fontPx, 'moveMs' => 360],
            'slide' => ['tags' => '\fad(240,0)', 'dy' => 0.4 * $fontPx, 'moveMs' => 320],
            default => ['tags' => '', 'dy' => 0],
        };
    }

    /* ------------------------------------------------------------ timed frames */

    /** Word timings from transcript data, or estimated by token length (same as the editor). */
    public function wordTimings(string $text, float $start, float $end, ?array $words): array
    {
        $tokens = $this->tokens($text);
        if (is_array($words) && count($words) === count($tokens) && count($tokens) > 0) {
            return array_map(fn ($w) => ['start' => (float) $w['start'], 'end' => (float) $w['end']], array_values($words));
        }
        $weights = array_map(fn ($t) => max(1, mb_strlen($t)), $tokens);
        $total = array_sum($weights) ?: 1;
        $cursor = $start;
        $out = [];
        foreach ($weights as $wgt) {
            $d = $wgt / $total * ($end - $start);
            $out[] = ['start' => $cursor, 'end' => $cursor + $d];
            $cursor += $d;
        }

        return $out;
    }

    protected function wordFrames(string $text, float $start, float $end, ?array $words): array
    {
        $timings = $this->wordTimings($text, $start, $end, $words);
        $points = [$start, $end];
        foreach ($timings as $t) {
            $points[] = max($start, min($end, $t['start']));
            $points[] = max($start, min($end, $t['end']));
        }
        $points = array_values(array_unique(array_map(fn ($p) => round($p, 2), $points)));
        sort($points);

        $frames = [];
        for ($i = 0; $i < count($points) - 1; $i++) {
            [$a, $b] = [$points[$i], $points[$i + 1]];
            if ($b - $a < 0.01) {
                continue;
            }
            $mid = ($a + $b) / 2;
            $active = -1;
            foreach ($timings as $wi => $t) {
                if ($mid >= $t['start'] && $mid < $t['end']) {
                    $active = $wi;
                    break;
                }
            }
            $last = end($frames);
            if ($last && $last['word'] === $active) {
                $frames[array_key_last($frames)]['end'] = $b;
            } else {
                $frames[] = ['start' => $a, 'end' => $b, 'word' => $active, 'visible' => null];
            }
        }

        return $frames ?: [['start' => $start, 'end' => $end, 'word' => -1, 'visible' => null]];
    }

    protected function typewriterFrames(string $text, float $start, float $end): array
    {
        $count = count($this->graphemes($text));
        $reveal = max(0.3, min($end - $start, $count * 0.06));
        $steps = max(1, min($count, 60));
        $frames = [];
        for ($k = 1; $k <= $steps; $k++) {
            $visible = (int) ceil($k / $steps * $count);
            $a = $start + ($k - 1) / $steps * $reveal;
            $b = $k === $steps ? $end : $start + $k / $steps * $reveal;
            $frames[] = ['start' => $a, 'end' => $b, 'word' => -1, 'visible' => $visible];
        }

        return $frames;
    }

    /* ------------------------------------------------------------------ markup */

    /**
     * Split text into font runs exactly like the browser's CSS fallback for the stack
     * "<English font>, <Sinhala font>": the Latin font has spaces, digits and
     * punctuation, so only Sinhala-block characters (plus ZWJ/ZWNJ, which belong to
     * Sinhala conjuncts) fall through to the Sinhala font. Matching this keeps word
     * spacing — and therefore line wrapping — identical to the preview.
     *
     * @return array<int, array{script: string, text: string}>
     */
    public function scriptRuns(string $text): array
    {
        $runs = [];
        foreach (preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $ch) {
            $script = preg_match('/[\x{0D80}-\x{0DFF}\x{200C}\x{200D}]/u', $ch) ? 'sinhala' : 'latin';
            $last = array_key_last($runs);
            if ($last !== null && $runs[$last]['script'] === $script) {
                $runs[$last]['text'] .= $ch;
            } else {
                $runs[] = ['script' => $script, 'text' => $ch];
            }
        }

        return $runs;
    }

    protected function runTags(string $script, array $s, float $scale): string
    {
        $css = $script === 'sinhala' ? $s['fontFamily'] : $s['englishFontFamily'];
        $family = $this->fonts->family($css, $script);
        $size = $s['fontSize'] * $scale * $this->fonts->sizeFactor($family);
        $italic = $s['fontStyle'] === 'italic';
        $face = $this->fonts->face($family, (int) $s['fontWeight'], $italic);

        // \i1 on a non-italic face makes libass slant it — same as the preview's synthetic italic.
        return sprintf('{\fn%s\fs%s\b%d\i%d}', $face['name'], $this->num($size), $face['weight'], $italic ? 1 : 0);
    }

    protected function markup(array $runs, array $s, float $scale): string
    {
        $out = '';
        foreach ($runs as $run) {
            $out .= $this->runTags($run['script'], $s, $scale).$this->escape($run['text']);
        }

        return $out;
    }

    /** Full text where word $active gets $onTags and every other word $offTags. */
    protected function wordMarkup(string $text, int $active, array $s, float $scale, string $onTags, string $offTags): string
    {
        $parts = preg_split('/(\s+)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
        $out = '';
        $wordIndex = -1;
        foreach ($parts as $part) {
            if (preg_match('/^\s+$/u', $part)) {
                $out .= $this->escape($part);

                continue;
            }
            $wordIndex++;
            $tags = $wordIndex === $active ? $onTags : $offTags;
            $out .= '{'.$tags.'}'.$this->markup($this->scriptRuns($part), $s, $scale);
        }

        return $out;
    }

    /** First $visible graphemes shown, the rest fully transparent (keeps layout stable). */
    protected function typewriterMarkup(string $text, int $visible, array $s, float $scale): string
    {
        $graphemes = $this->graphemes($text);
        $shown = implode('', array_slice($graphemes, 0, $visible));
        $hidden = implode('', array_slice($graphemes, $visible));
        $out = $this->markup($this->scriptRuns($shown), $s, $scale);
        if ($hidden !== '') {
            $out .= '{\alpha&HFF&}'.$this->markup($this->scriptRuns($hidden), $s, $scale);
        }

        return $out;
    }

    /** Extended grapheme clusters, gluing Sinhala ZWJ conjuncts (mirrors frontend splitGraphemes). */
    public function graphemes(string $text): array
    {
        preg_match_all('/\X/u', $text, $m);
        $out = [];
        foreach ($m[0] as $cluster) {
            $prev = $out === [] ? null : $out[array_key_last($out)];
            if ($prev !== null && (str_ends_with($prev, self::ZWJ) || (str_ends_with($prev, self::AL_LAKUNA) && str_starts_with($cluster, self::ZWJ)))) {
                $out[array_key_last($out)] .= $cluster;
            } else {
                $out[] = $cluster;
            }
        }

        return $out;
    }

    /** libass escaping: braces start override blocks; backslash starts \N \n \h. */
    public function escape(string $text): string
    {
        return strtr($text, [
            '\\' => "\\\u{2060}", // word joiner breaks accidental \N / \h sequences
            '{' => '\\{',
            '}' => '\\}',
            "\n" => '\\N',
        ]);
    }

    protected function cleanText(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        if (class_exists(\Normalizer::class)) {
            $text = \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
        }

        return trim(preg_replace("/\n{2,}/", "\n", $text) ?? $text);
    }

    protected function tokens(string $text): array
    {
        return preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    }

    /* --------------------------------------------------------------- formatting */

    protected function header(int $w, int $h, array $style): string
    {
        $sinhala = $this->fonts->family($style['fontFamily'], 'sinhala');
        $format = 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding';

        return implode("\n", [
            '[Script Info]',
            '; Generated by '.config('brand.name').' caption renderer',
            'ScriptType: v4.00+',
            "PlayResX: {$w}",
            "PlayResY: {$h}",
            'WrapStyle: 1',
            'ScaledBorderAndShadow: yes',
            'YCbCr Matrix: TV.709',
            '',
            '[V4+ Styles]',
            $format,
            "Style: Text,{$sinhala},48,&H00FFFFFF,&H00FFFFFF,&H00000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,2,0,0,0,1",
            "Style: Box,{$sinhala},48,&HFF000000,&HFF000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,4,0,0,2,0,0,0,1",
            "Style: WordBox,{$sinhala},48,&HFF000000,&HFF000000,&H00000000,&HFF000000,0,0,0,0,100,100,0,0,3,0,0,2,0,0,0,1",
            '',
            '[Events]',
            'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
            '',
        ]);
    }

    /** #RRGGBB → &HBBGGRR& */
    public function color(string $hex): string
    {
        $hex = ltrim($this->normalizer->normalizeColor($hex) ?? '#FFFFFF', '#');

        return sprintf('&H%s%s%s&', substr($hex, 4, 2), substr($hex, 2, 2), substr($hex, 0, 2));
    }

    /** Opacity 0–100 → ASS alpha (&H00& opaque … &HFF& transparent). */
    public function alpha(float $opacityPercent): string
    {
        return sprintf('&H%02X&', (int) round(255 - max(0, min(100, $opacityPercent)) / 100 * 255));
    }

    /** Seconds → H:MM:SS.cc */
    public function time(float $seconds): string
    {
        $cs = (int) round(max(0, $seconds) * 100);

        return sprintf('%d:%02d:%02d.%02d', intdiv($cs, 360000), intdiv($cs % 360000, 6000), intdiv($cs % 6000, 100), $cs % 100);
    }

    protected function num(float $n): string
    {
        return rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.') ?: '0';
    }

    protected function anchorParts(string $matrix): array
    {
        if ($matrix === 'center') {
            return ['mid', 'center'];
        }

        return explode('-', $matrix, 2);
    }
}
