<?php

namespace App\Services\AI;

/** Leaves captions exactly as transcribed (cleanup disabled, or the fake provider). */
class NullCaptionRefiner implements CaptionRefinerInterface
{
    public function refine(array $lines, string $language): array
    {
        return array_column($lines, 'text');
    }

    public function model(): ?string
    {
        return null;
    }
}
