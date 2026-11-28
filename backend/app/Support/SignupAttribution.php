<?php

namespace App\Support;

/**
 * Where a new account came from: the UTM tags (or referring site) of the visitor's first visit,
 * which the web app keeps and sends with registration as `attribution`.
 */
class SignupAttribution
{
    /**
     * Validation rules for the optional `attribution` object on the sign-up endpoints.
     *
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'attribution' => ['nullable', 'array:source,medium,campaign,referrer'],
            'attribution.source' => ['nullable', 'string', 'max:100'],
            'attribution.medium' => ['nullable', 'string', 'max:100'],
            'attribution.campaign' => ['nullable', 'string', 'max:100'],
            'attribution.referrer' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * User columns for a validated `attribution` object. Without UTM tags, a referring site
     * counts as the source with medium "referral".
     *
     * @param  array{source?: ?string, medium?: ?string, campaign?: ?string, referrer?: ?string}|null  $attribution
     * @return array{signup_source: ?string, signup_medium: ?string, signup_campaign: ?string, signup_referrer: ?string}
     */
    public static function toColumns(?array $attribution): array
    {
        $source = self::clean($attribution['source'] ?? null);
        $medium = self::clean($attribution['medium'] ?? null);
        $referrer = self::host($attribution['referrer'] ?? null);

        if ($source === null && $referrer !== null) {
            $source = $referrer;
            $medium ??= 'referral';
        }

        return [
            'signup_source' => $source,
            'signup_medium' => $medium,
            'signup_campaign' => self::clean($attribution['campaign'] ?? null),
            'signup_referrer' => $referrer,
        ];
    }

    private static function clean(?string $value): ?string
    {
        $value = mb_strtolower(trim((string) $value));

        return $value === '' ? null : mb_substr($value, 0, 100);
    }

    /** Only the host of a referring URL ("www.facebook.com/x" → "facebook.com"). */
    private static function host(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        $host = parse_url(str_contains($value, '://') ? $value : 'https://'.$value, PHP_URL_HOST);
        if (! is_string($host) || $host === '') {
            return null;
        }

        return preg_replace('/^www\./', '', mb_strtolower($host));
    }
}
