<?php

namespace App\Services\AI;

/**
 * Deterministic provider for tests and for local development without a Gemini key.
 * Never used in production (see AppServiceProvider). Output is clearly sample text.
 */
class FakeAIProvider implements AIProviderInterface
{
    public function name(): string
    {
        return 'fake';
    }

    public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
    {
        $lang = $language === 'en' ? 'en' : 'si';
        $lines = $lang === 'si'
            ? [
                [0.5, 3.2, 'ආයුබෝවන්, අපගේ වීඩියෝවට සාදරයෙන් පිළිගනිමු.'],
                [3.45, 6.8, 'මෙය නියැදි උපසිරැසියකි — AI යතුර සකසා නැත.'],
                [7.0, 10.5, 'සැබෑ උපසිරැසි සඳහා GEMINI_API_KEY සකසන්න.'],
            ]
            : [
                [0.5, 3.2, 'Welcome to the caption studio.'],
                [3.45, 6.8, 'This is sample text — no AI key is configured.'],
                [7.0, 10.5, 'Set GEMINI_API_KEY to generate real captions.'],
            ];

        $segments = SegmentNormalizer::normalize(
            array_map(fn ($l) => ['start' => $l[0], 'end' => $l[1], 'text' => $l[2], 'language' => $lang], $lines),
            $lang,
            $options['duration'] ?? null,
        );

        return [
            'text' => implode(' ', array_column($segments, 'text')),
            'language' => $lang,
            'segments' => $segments,
            'usage' => ['model' => 'fake'],
        ];
    }
}
