<?php

namespace App\Services\AI;

/** Deterministic writing help for tests and local runs without a Gemini key. Output is clearly sample text. */
class FakeTextAssistant implements TextAssistantInterface
{
    public function model(): ?string
    {
        return 'fake';
    }

    public function singlishToSinhala(array $lines): array
    {
        return array_map(fn ($l) => "[සිංහල] {$l}", $lines);
    }

    public function translate(array $lines, string $to): array
    {
        return array_map(fn ($l) => "[{$to}] {$l}", $lines);
    }

    public function script(string $topic, string $language, int $seconds, string $tone): array
    {
        return ["Sample script about {$topic}.", 'Set GEMINI_API_KEY to write real scripts.', 'Thanks for watching!'];
    }

    public function titles(string $context, string $language): array
    {
        return ['Sample title one', 'Sample title two', 'Sample title three'];
    }

    public function highlights(array $lines, int $count): array
    {
        return array_slice(array_map(fn ($l) => [
            'start' => (float) $l['start'],
            'end' => (float) $l['end'],
            'title' => mb_substr($l['text'], 0, 40),
            'reason' => 'Sample highlight.',
        ], $lines), 0, $count);
    }
}
