<?php

namespace App\Services\Rendering;

/**
 * Minimal, read-only TrueType/OpenType table reader for the few metrics the caption
 * renderer needs. Reads only the table directory, `head` and `OS/2`.
 */
final class TrueTypeMetrics
{
    /**
     * @return array{family:?string, subfamily:?string, typographicFamily:?string, unitsPerEm:int, winAscent:int, winDescent:int, weightClass:int, italic:bool}|null
     */
    public static function read(string $path): ?array
    {
        $fh = @fopen($path, 'rb');
        if (!$fh) {
            return null;
        }
        try {
            $header = fread($fh, 12);
            if (strlen($header) < 12) {
                return null;
            }
            $numTables = unpack('n', substr($header, 4, 2))[1];
            if ($numTables < 1 || $numTables > 512) {
                return null;
            }
            $dir = fread($fh, 16 * $numTables);
            $tables = [];
            for ($i = 0; $i < $numTables; $i++) {
                $rec = substr($dir, $i * 16, 16);
                if (strlen($rec) < 16) {
                    break;
                }
                $tag = substr($rec, 0, 4);
                $info = unpack('Noffset/Nlength', substr($rec, 8, 8));
                $tables[$tag] = $info;
            }
            if (!isset($tables['head'], $tables['OS/2'])) {
                return null;
            }

            fseek($fh, $tables['head']['offset'] + 18);
            $unitsPerEm = unpack('n', fread($fh, 2))[1];

            fseek($fh, $tables['OS/2']['offset']);
            $os2 = fread($fh, 78);
            if (strlen($os2) < 78) {
                return null;
            }
            $weightClass = unpack('n', substr($os2, 4, 2))[1];
            $fsSelection = unpack('n', substr($os2, 62, 2))[1];
            $winAscent = unpack('n', substr($os2, 74, 2))[1];
            $winDescent = unpack('n', substr($os2, 76, 2))[1];

            $names = isset($tables['name']) ? self::names($fh, $tables['name']['offset']) : [];

            return [
                'family' => $names[1] ?? null,
                'subfamily' => $names[2] ?? null,
                'typographicFamily' => $names[16] ?? ($names[1] ?? null),
                'unitsPerEm' => $unitsPerEm,
                'winAscent' => $winAscent,
                'winDescent' => $winDescent,
                'weightClass' => $weightClass,
                'italic' => (bool) ($fsSelection & 1),
            ];
        } finally {
            fclose($fh);
        }
    }

    /** Name IDs 1, 2 and 16 (Windows Unicode preferred, Mac Roman fallback). */
    protected static function names($fh, int $offset): array
    {
        fseek($fh, $offset);
        $head = fread($fh, 6);
        if (strlen($head) < 6) {
            return [];
        }
        ['count' => $count, 'stringOffset' => $stringOffset] = unpack('nformat/ncount/nstringOffset', $head);
        $records = fread($fh, 12 * min($count, 1024));
        $found = [];
        for ($i = 0; $i < min($count, 1024); $i++) {
            $r = unpack('nplatform/nencoding/nlanguage/nnameId/nlength/noffset', substr($records, $i * 12, 12));
            if (!in_array($r['nameId'], [1, 2, 16], true)) {
                continue;
            }
            $windows = $r['platform'] === 3 && $r['encoding'] === 1;
            $mac = $r['platform'] === 1 && $r['encoding'] === 0;
            if (!$windows && !$mac) {
                continue;
            }
            $score = $windows ? ($r['language'] === 0x409 ? 3 : 2) : 1;
            if (($found[$r['nameId']]['score'] ?? 0) >= $score) {
                continue;
            }
            fseek($fh, $offset + $stringOffset + $r['offset']);
            $raw = fread($fh, $r['length']);
            $value = $windows ? mb_convert_encoding($raw, 'UTF-8', 'UTF-16BE') : mb_convert_encoding($raw, 'UTF-8', 'MACINTOSH');
            $found[$r['nameId']] = ['score' => $score, 'value' => trim($value)];
        }

        return array_map(fn ($f) => $f['value'], $found);
    }
}
