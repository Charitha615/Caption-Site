<?php

namespace App\Services\Caption;

use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use Illuminate\Support\Collection;

/**
 * Text subtitle formats (SRT, WebVTT, TXT, JSON) generated straight from structured captions.
 *
 * Unicode-safe: text is NFC-normalised and written as UTF-8 (no transcoding), so
 * Sinhala — including ZWJ conjuncts such as ශ්‍රී — round-trips byte-exact.
 */
class SubtitleFormatterService implements SubtitleFormatterInterface
{
    public function toSrt(Collection|array $captions): string
    {
        $blocks = [];
        $index = 1;
        foreach ($this->cues($captions) as $cue) {
            // A blank line ends an SRT cue, so blank lines inside text would corrupt the file.
            $text = preg_replace("/\n{2,}/", "\n", $cue['text']);
            $blocks[] = $index++ . "\n"
                . $this->timestamp($cue['start'], ',') . ' --> ' . $this->timestamp($cue['end'], ',') . "\n"
                . $text;
        }

        return $blocks ? implode("\n\n", $blocks) . "\n" : '';
    }

    public function toVtt(Collection|array $captions): string
    {
        $out = "WEBVTT\n";
        foreach ($this->cues($captions) as $cue) {
            $text = preg_replace("/\n{2,}/", "\n", $cue['text']);
            // WebVTT cue text is HTML-like: escape &, <, > and never allow a literal "-->".
            $text = str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $text);
            $out .= "\n" . $this->timestamp($cue['start'], '.') . ' --> ' . $this->timestamp($cue['end'], '.') . "\n" . $text . "\n";
        }

        return $out;
    }

    public function toTxt(Collection|array $captions): string
    {
        $lines = array_map(fn ($cue) => $cue['text'], $this->cues($captions));

        return $lines ? implode("\n\n", $lines) . "\n" : '';
    }

    /**
     * Structured export. Includes everything needed to rebuild the timeline elsewhere.
     */
    public function toJson(Collection|array $captions, array $meta = []): string
    {
        $items = [];
        foreach ($this->normalized($captions) as $i => $c) {
            $item = [
                'sequence' => $i + 1,
                'start' => $c['start'],
                'end' => $c['end'],
                'text' => $c['text'],
                'language' => $c['language'],
            ];
            if (!empty($c['words'])) {
                $item['words'] = $c['words'];
            }
            if (!empty($c['style_override'])) {
                $item['style_override'] = $c['style_override'];
            }
            $items[] = $item;
        }

        return json_encode(
            ['version' => 1] + $meta + ['captions' => $items],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
        ) . "\n";
    }

    /**
     * Format seconds as HH:MM:SS{sep}mmm. Works in integer milliseconds so 59.9996
     * becomes 00:01:00,000 instead of the invalid 00:00:59,1000.
     */
    public function timestamp(float $seconds, string $separator = ','): string
    {
        $ms = (int) round(max(0, $seconds) * 1000);

        return sprintf(
            '%02d:%02d:%02d%s%03d',
            intdiv($ms, 3_600_000),
            intdiv($ms % 3_600_000, 60_000),
            intdiv($ms % 60_000, 1000),
            $separator,
            $ms % 1000,
        );
    }

    /** Non-empty cues in time order with valid ranges. */
    protected function cues(Collection|array $captions): array
    {
        return array_values(array_filter(
            $this->normalized($captions),
            fn ($c) => $c['text'] !== '',
        ));
    }

    protected function normalized(Collection|array $captions): array
    {
        $rows = collect($captions)->map(function ($c) {
            $get = fn (string $key, $default = null) => is_array($c) ? ($c[$key] ?? $default) : ($c->{$key} ?? $default);
            $text = (string) $get('text', '');
            $text = str_replace(["\r\n", "\r"], "\n", $text);
            if (class_exists(\Normalizer::class)) {
                $text = \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
            }
            $text = trim(preg_replace('/[ \t]+\n/u', "\n", $text) ?? $text);
            $text = str_replace('-->', '→', $text);

            $start = (float) $get('start_time', $get('start', 0));
            $end = (float) $get('end_time', $get('end', $start));
            $metadata = $get('metadata', []);
            $words = is_array($metadata) ? ($metadata['words'] ?? null) : null;

            return [
                'start' => round(max(0, $start), 3),
                'end' => round(max($start + 0.001, $end), 3),
                'text' => $text,
                'language' => (string) $get('language', 'si'),
                'words' => is_array($words) ? array_values($words) : null,
                'style_override' => $get('style_override'),
                'sequence' => (int) $get('sequence', 0),
            ];
        })->all();

        usort($rows, fn ($a, $b) => [$a['start'], $a['sequence']] <=> [$b['start'], $b['sequence']]);

        return $rows;
    }
}
