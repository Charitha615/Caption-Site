<?php

namespace App\Services\Rendering;

/**
 * FFmpeg filtergraph escaping (https://ffmpeg.org/ffmpeg-filters.html#Notes-on-filtergraph-escaping).
 *
 * A value inside a filter description is unescaped twice:
 *   1. as a filter option value  — special: \ ' :
 *   2. as part of the filtergraph — special: \ ' [ ] , ;
 * We escape for both levels. Combined with passing argv to Symfony Process (no
 * shell), no path or user input can inject filters, options or commands.
 */
final class FilterEscaper
{
    public static function optionValue(string $value): string
    {
        if (str_contains($value, "\0")) {
            throw new \InvalidArgumentException('Filter values must not contain NUL bytes.');
        }

        $level1 = strtr($value, ['\\' => '\\\\', "'" => "\\'", ':' => '\\:']);

        return strtr($level1, ['\\' => '\\\\', "'" => "\\'", '[' => '\\[', ']' => '\\]', ',' => '\\,', ';' => '\\;']);
    }
}
