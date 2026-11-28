<?php

namespace App\Support;

/** WhatsApp numbers, stored as international digits (e.g. 94771234567). Local Sri Lankan numbers get +94. */
class PhoneNumber
{
    /** "077 123 4567" or "+94 77 123 4567" → "94771234567"; null when empty or not a plausible number. */
    public static function normalize(?string $input): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $input) ?? '';
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0')) {
            $digits = '94'.substr($digits, 1);
        }

        return strlen($digits) >= 9 && strlen($digits) <= 15 ? $digits : null;
    }

    /**
     * Validation rule for an optional WhatsApp number.
     *
     * @return array<int, mixed>
     */
    public static function rules(): array
    {
        return ['nullable', 'string', 'max:24', function (string $attribute, mixed $value, \Closure $fail) {
            if (is_string($value) && trim($value) !== '' && self::normalize($value) === null) {
                $fail('Enter a WhatsApp number like 077 123 4567.');
            }
        }];
    }
}
