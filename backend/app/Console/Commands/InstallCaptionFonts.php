<?php

namespace App\Console\Commands;

use App\Services\Rendering\FontRegistry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Downloads the caption fonts used by the editor (static TTF instances from
 * Google Fonts, all SIL OFL) into config('captions.fonts_path') so the MP4
 * renderer burns exactly the fonts the preview shows.
 */
class InstallCaptionFonts extends Command
{
    protected $signature = 'captions:install-fonts {--force : Re-download fonts that already exist}';

    protected $description = 'Download the caption fonts (Sinhala + English) used for MP4 rendering';

    public function handle(): int
    {
        $dir = (string) config('captions.fonts_path');
        if (! is_dir($dir) && ! mkdir($dir, 0755, true) && ! is_dir($dir)) {
            $this->error("Cannot create {$dir}");

            return self::FAILURE;
        }

        $failures = 0;
        foreach (config('captions.fonts') as $entry) {
            if (empty($entry['google'])) {
                $this->line("• {$entry['family']}: system font, skipped");

                continue;
            }
            try {
                $count = $this->installFamily($entry['family'], $entry['google'], $dir);
                $this->info("✓ {$entry['family']}: {$count} file(s)");
            } catch (\Throwable $e) {
                $failures++;
                $this->error("✗ {$entry['family']}: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->line("Fonts directory: {$dir}");

        return $failures ? self::FAILURE : self::SUCCESS;
    }

    protected function installFamily(string $family, string $spec, string $dir): int
    {
        // A non-browser User-Agent makes Google Fonts return complete static TrueType files
        // (not per-subset woff2), which is what libass needs.
        $css = Http::withHeaders(['User-Agent' => 'Mozilla/5.0 (caption-font-installer)'])
            ->timeout(30)
            ->get('https://fonts.googleapis.com/css2', ['family' => $spec])
            ->throw()
            ->body();

        preg_match_all('/@font-face\s*{([^}]*)}/', $css, $faces);
        $count = 0;
        foreach ($faces[1] as $face) {
            preg_match('/font-weight:\s*(\d+)/', $face, $w);
            preg_match('/font-style:\s*(\w+)/', $face, $st);
            preg_match('/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/', $face, $url);
            if (! $w || ! $url) {
                continue;
            }
            $italic = ($st[1] ?? 'normal') === 'italic' ? '-italic' : '';
            $target = $dir.DIRECTORY_SEPARATOR.FontRegistry::fileStem($family)."-{$w[1]}{$italic}.ttf";
            if (is_file($target) && ! $this->option('force')) {
                $count++;

                continue;
            }
            $bytes = Http::timeout(60)->get($url[1])->throw()->body();
            if (strlen($bytes) < 1000 || ! in_array(substr($bytes, 0, 4), ["\x00\x01\x00\x00", 'true', 'OTTO'], true)) {
                throw new \RuntimeException('Downloaded file is not a TrueType font.');
            }
            file_put_contents($target, $bytes);
            $count++;
        }
        if ($count === 0) {
            throw new \RuntimeException('No TrueType files were offered.');
        }

        return $count;
    }
}
