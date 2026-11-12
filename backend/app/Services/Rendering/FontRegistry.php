<?php

namespace App\Services\Rendering;

/**
 * Maps editor font values (CSS font-family strings) to font files and metrics.
 *
 * Why metrics matter: CSS `font-size` sets the em size, but libass sizes text so
 * that the font's (usWinAscent + usWinDescent) equals the ASS font size. Sinhala
 * fonts have tall ascent/descent, so without correction burned captions would be
 * noticeably smaller than the browser preview. sizeFactor() returns
 * (winAscent + winDescent) / unitsPerEm for that conversion.
 */
class FontRegistry
{
    /** Typical factor for fonts we can't read (≈ Noto Latin). */
    public const DEFAULT_SIZE_FACTOR = 1.21;

    /** @var array<string, float> */
    protected array $factorCache = [];

    public function __construct(
        protected ?string $fontsPath = null,
        protected ?array $fonts = null,
    ) {
        $this->fontsPath ??= (string) config('captions.fonts_path');
        $this->fonts ??= (array) config('captions.fonts', []);
    }

    public function fontsPath(): string
    {
        return $this->fontsPath;
    }

    public function family(string $cssValue, string $script): string
    {
        $entry = $this->fonts[$cssValue] ?? null;
        if ($entry && $entry['script'] === $script) {
            return $entry['family'];
        }
        $fallback = $script === 'sinhala' ? config('captions.default_sinhala_font') : config('captions.default_latin_font');

        return $this->fonts[$fallback]['family'] ?? ($script === 'sinhala' ? 'Noto Sans Sinhala' : 'Inter');
    }

    public function sizeFactor(string $family): float
    {
        if (isset($this->factorCache[$family])) {
            return $this->factorCache[$family];
        }

        $factor = self::DEFAULT_SIZE_FACTOR;
        $file = $this->findFile($family);
        if ($file) {
            $m = TrueTypeMetrics::read($file);
            if ($m && $m['unitsPerEm'] > 0 && ($m['winAscent'] + $m['winDescent']) > 0) {
                $factor = ($m['winAscent'] + $m['winDescent']) / $m['unitsPerEm'];
            }
        }

        return $this->factorCache[$family] = $factor;
    }

    /** @var array<string, list<array{name: string, weight: int, italic: bool}>>|null */
    protected ?array $faceIndex = null;

    /**
     * The installed face libass should use for (family, weight, italic), following the
     * CSS font-matching rules browsers use, so preview and render pick the same face.
     *
     * libass matches the *legacy* family name (name ID 1): Google's static files name
     * a semibold face "Poppins SemiBold", so "\fnPoppins\b600" would silently fall back
     * to Regular. We therefore return that exact name.
     *
     * @return array{name: string, weight: int, italic: bool} italic = the face itself is italic
     */
    public function face(string $family, int $weight, bool $italic): array
    {
        $faces = $this->faces()[$family] ?? [];
        if ($faces === []) {
            return ['name' => $family, 'weight' => $weight, 'italic' => $italic];
        }
        $sameStyle = array_values(array_filter($faces, fn ($f) => $f['italic'] === $italic));
        $pool = $sameStyle ?: $faces;
        usort($pool, fn ($a, $b) => self::weightRank($weight, $a['weight']) <=> self::weightRank($weight, $b['weight']));

        return $pool[0];
    }

    /** CSS Fonts §5.2 weight preference: lower rank = better match. */
    protected static function weightRank(int $desired, int $available): int
    {
        if ($available === $desired) {
            return 0;
        }
        if ($desired >= 400 && $desired <= 500 && $available > $desired && $available <= 500) {
            return $available - $desired;
        }
        $preferHeavier = $desired > 500;
        $inPreferredDirection = $preferHeavier ? $available > $desired : $available < $desired;

        return ($inPreferredDirection ? 1000 : 2000) + abs($available - $desired);
    }

    protected function faces(): array
    {
        if ($this->faceIndex !== null) {
            return $this->faceIndex;
        }
        $index = [];
        foreach (glob($this->fontsPath . DIRECTORY_SEPARATOR . '*.ttf') ?: [] as $file) {
            $m = TrueTypeMetrics::read($file);
            if (!$m || !$m['family'] || !$m['typographicFamily']) {
                continue;
            }
            // Static instances often lack name ID 16; "Poppins SemiBold" → base family "Poppins".
            $base = $m['typographicFamily'] !== $m['family']
                ? $m['typographicFamily']
                : trim(preg_replace('/\s+(Thin|Hairline|ExtraLight|UltraLight|Light|Regular|Medium|SemiBold|DemiBold|ExtraBold|UltraBold|Bold|Black|Heavy|Italic)(\s+Italic)?$/i', '', $m['family']));
            $index[$base][] = [
                'name' => $m['family'],
                'weight' => $m['weightClass'] ?: 400,
                'italic' => $m['italic'] || str_contains(strtolower((string) $m['subfamily']), 'italic'),
            ];
        }

        return $this->faceIndex = $index;
    }

    /** Families referenced by the config whose files are not installed. */
    public function missingFamilies(): array
    {
        $missing = [];
        foreach ($this->fonts as $entry) {
            if (!empty($entry['google']) && !$this->findFile($entry['family'])) {
                $missing[] = $entry['family'];
            }
        }

        return array_values(array_unique($missing));
    }

    public function findFile(string $family): ?string
    {
        if (!is_dir($this->fontsPath)) {
            return null;
        }
        $prefix = self::fileStem($family);
        $files = glob($this->fontsPath . DIRECTORY_SEPARATOR . $prefix . '-*.ttf') ?: [];
        sort($files);
        // Prefer the regular (400) instance for metrics; all weights share vertical metrics anyway.
        foreach ($files as $f) {
            if (str_ends_with($f, '-400.ttf')) {
                return $f;
            }
        }

        return $files[0] ?? null;
    }

    public static function fileStem(string $family): string
    {
        return preg_replace('/[^A-Za-z0-9]+/', '', $family);
    }
}
