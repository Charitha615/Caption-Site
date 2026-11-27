<?php

namespace App\Support;

/**
 * Reads a browser's User-Agent header into a short, human description for the
 * "Signed-in devices" list ("Chrome on Windows", "Safari on iPhone").
 *
 * Deliberately small: it recognises the common browsers and systems and falls back
 * to "Unknown" instead of guessing. Order matters: Edge and Opera also say "Chrome",
 * and Chrome also says "Safari".
 */
class UserAgent
{
    /**
     * @return array{browser: string, os: string, device: 'desktop'|'mobile'|'tablet'}
     */
    public static function parse(?string $userAgent): array
    {
        $ua = (string) $userAgent;

        $browser = match (true) {
            $ua === '' => 'Unknown browser',
            (bool) preg_match('/Edg(e|A|iOS)?\//', $ua) => 'Edge',
            (bool) preg_match('/OPR\/|Opera/', $ua) => 'Opera',
            (bool) preg_match('/SamsungBrowser\//', $ua) => 'Samsung Internet',
            (bool) preg_match('/Brave\//', $ua) => 'Brave',
            (bool) preg_match('/Firefox\/|FxiOS\//', $ua) => 'Firefox',
            (bool) preg_match('/CriOS\/|Chrome\/|Chromium\//', $ua) => 'Chrome',
            (bool) preg_match('/Safari\//', $ua) && str_contains($ua, 'Version/') => 'Safari',
            default => 'Unknown browser',
        };

        $os = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'CrOS') => 'ChromeOS',
            // iPadOS Safari presents itself as a Mac; touch support is the only hint, so it shows as a Mac.
            str_contains($ua, 'Macintosh') || str_contains($ua, 'Mac OS X') => 'Mac',
            str_contains($ua, 'Linux') => 'Linux',
            default => 'Unknown system',
        };

        $device = match (true) {
            $os === 'iPad' || ($os === 'Android' && ! str_contains($ua, 'Mobile')) => 'tablet',
            $os === 'iPhone' || $os === 'Android' || str_contains($ua, 'Mobile') => 'mobile',
            default => 'desktop',
        };

        return ['browser' => $browser, 'os' => $os, 'device' => $device];
    }

    /** "Chrome on Windows" */
    public static function describe(?string $userAgent): string
    {
        $info = self::parse($userAgent);

        return "{$info['browser']} on {$info['os']}";
    }
}
