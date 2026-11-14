<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Rejects arrays whose JSON encoding exceeds $maxBytes (guards JSON columns). */
class JsonSize implements ValidationRule
{
    public function __construct(private int $maxBytes) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (strlen((string) json_encode($value, JSON_UNESCAPED_UNICODE)) > $this->maxBytes) {
            $fail('The :attribute is too large.');
        }
    }
}
