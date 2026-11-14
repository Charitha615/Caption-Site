<?php

namespace App\Services\Caption;

/**
 * Server-side twin of the editor's sanitizeStyle() (frontend utils/captionStyle.ts).
 *
 * Caption styles arrive from the browser as untrusted JSON. Everything that is
 * persisted as a template or handed to the renderer passes through here, so the
 * renderer can rely on every key existing, being the right type and in range.
 *
 * Pixel values are in "1080p reference units" (relative to a frame whose short
 * side is 1080 px) — see docs/ARCHITECTURE.md §8.
 */
class CaptionStyleNormalizer
{
    public const DEFAULTS = [
        'preset' => 'spotlight',
        'englishFontFamily' => '"Poppins", sans-serif',
        'fontFamily' => '"Noto Sans Sinhala", sans-serif',
        'fontSize' => 64,
        'fontWeight' => 800,
        'fontStyle' => 'normal',
        'lineHeight' => 1.35,
        'letterSpacing' => 0,
        'textColor' => '#FFFFFF',
        'highlightColor' => '#FFD400',
        'highlightTextColor' => '#000000',
        'activeWordScale' => 115,
        'textTransform' => 'none',
        'outlineColor' => '#000000',
        'outlineWidth' => 6,
        'shadowColor' => '#000000',
        'shadowOpacity' => 60,
        'shadowBlur' => 8,
        'shadowOffsetX' => 0,
        'shadowOffsetY' => 3,
        'backgroundColor' => '#000000',
        'backgroundOpacity' => 0,
        'borderRadius' => 12,
        'padding' => 12,
        'textAlign' => 'center',
        'alignMatrix' => 'bottom-center',
        'positionX' => 50,
        'positionY' => 92,
        'maxWidth' => 80,
        'animation' => 'karaoke',
    ];

    /** [min, max] for numeric properties. */
    public const RANGES = [
        'fontSize' => [8, 300],
        'fontWeight' => [100, 900],
        'lineHeight' => [0.8, 3],
        'letterSpacing' => [-20, 50],
        'outlineWidth' => [0, 40],
        'shadowOpacity' => [0, 100],
        'shadowBlur' => [0, 80],
        'shadowOffsetX' => [-60, 60],
        'shadowOffsetY' => [-60, 60],
        'backgroundOpacity' => [0, 100],
        'borderRadius' => [0, 120],
        'padding' => [0, 120],
        'positionX' => [0, 100],
        'positionY' => [0, 100],
        'maxWidth' => [10, 100],
        'activeWordScale' => [100, 150],
    ];

    public const ENUMS = [
        'fontStyle' => ['normal', 'italic'],
        'textAlign' => ['left', 'center', 'right'],
        'alignMatrix' => [
            'top-left', 'top-center', 'top-right',
            'mid-left', 'center', 'mid-right',
            'bottom-left', 'bottom-center', 'bottom-right',
        ],
        'animation' => ['none', 'fade', 'pop', 'bounce', 'slide', 'typewriter', 'karaoke', 'highlight'],
        'textTransform' => ['none', 'uppercase'],
    ];

    public const COLORS = ['textColor', 'highlightColor', 'highlightTextColor', 'outlineColor', 'shadowColor', 'backgroundColor'];

    public const FONTS = ['englishFontFamily', 'fontFamily'];

    /**
     * Normalise a full style: unknown keys dropped, invalid values replaced by defaults.
     */
    public function normalize(mixed $raw): array
    {
        return array_merge(self::DEFAULTS, $this->normalizePartial($raw));
    }

    /**
     * Normalise a partial style (per-caption override): only valid keys survive.
     */
    public function normalizePartial(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }
            $clean = $this->cleanValue($key, $value);
            if ($clean !== null) {
                $out[$key] = $clean;
            }
        }

        return $out;
    }

    /**
     * Effective style for one caption: global style with its override applied.
     */
    public function resolve(array $global, ?array $override): array
    {
        return array_merge($this->normalize($global), $this->normalizePartial($override ?? []));
    }

    /**
     * Validation helper: list of human-readable problems (empty = valid).
     */
    public function errors(mixed $raw): array
    {
        if (! is_array($raw)) {
            return ['Style must be an object.'];
        }
        $errors = [];
        foreach ($raw as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue; // unknown keys are ignored, not rejected (forward compatible)
            }
            if ($this->cleanValue($key, $value) === null) {
                $errors[] = "Invalid value for {$key}.";
            }
        }

        return $errors;
    }

    protected function cleanValue(string $key, mixed $value): mixed
    {
        if (isset(self::RANGES[$key])) {
            if (! is_numeric($value)) {
                return null;
            }
            [$min, $max] = self::RANGES[$key];
            $number = max($min, min($max, (float) $value));

            return $key === 'fontWeight' ? (int) round($number / 100) * 100 : $this->compactNumber($number);
        }

        if (isset(self::ENUMS[$key])) {
            return is_string($value) && in_array($value, self::ENUMS[$key], true) ? $value : null;
        }

        if (in_array($key, self::COLORS, true)) {
            return is_string($value) ? $this->normalizeColor($value) : null;
        }

        if (in_array($key, self::FONTS, true)) {
            return is_string($value) && array_key_exists($value, config('captions.fonts', [])) ? $value : null;
        }

        if ($key === 'preset') {
            return is_string($value) && preg_match('/^[A-Za-z0-9_\-]{1,80}$/', $value) ? $value : null;
        }

        return null;
    }

    /** Accepts #rgb, #rrggbb, #rrggbbaa (alpha ignored) and rgb()/rgba(). Returns #RRGGBB. */
    public function normalizeColor(string $value): ?string
    {
        $value = trim($value);
        if (preg_match('/^#([0-9a-f]{3})$/i', $value, $m)) {
            $h = $m[1];

            return strtoupper("#{$h[0]}{$h[0]}{$h[1]}{$h[1]}{$h[2]}{$h[2]}");
        }
        if (preg_match('/^#([0-9a-f]{6})([0-9a-f]{2})?$/i', $value, $m)) {
            return '#'.strtoupper($m[1]);
        }
        if (preg_match('/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i', $value, $m)) {
            [$r, $g, $b] = array_map(fn ($c) => min(255, (int) $c), [$m[1], $m[2], $m[3]]);

            return sprintf('#%02X%02X%02X', $r, $g, $b);
        }

        return null;
    }

    protected function compactNumber(float $n): int|float
    {
        $rounded = round($n, 3);

        return floor($rounded) == $rounded ? (int) $rounded : $rounded;
    }
}
