<?php

namespace App\Services\AI;

use App\Exceptions\AIProviderException;
use App\Support\AppLog;

/**
 * Tries the transcription model first and falls back to the text model when it is
 * unavailable, overloaded, rejects the language, or returns no word timings.
 * A rejected API key is not retried (the fallback would use the same key).
 */
class FallbackTranscriber implements AIProviderInterface
{
    private ?AIProviderInterface $used = null;

    public function __construct(
        protected AIProviderInterface $primary,
        protected AIProviderInterface $fallback,
    ) {}

    public function name(): string
    {
        return ($this->used ?? $this->primary)->name();
    }

    public function transcribe(string $audioFilePath, string $language = 'auto', array $options = []): array
    {
        try {
            $this->used = $this->primary;

            return $this->primary->transcribe($audioFilePath, $language, $options);
        } catch (AIProviderException $e) {
            if ($e->context['key_rejected'] ?? false) {
                throw $e;
            }
            AppLog::warning('ai.transcriber_fallback', [
                'from' => $this->primary->name(),
                'to' => $this->fallback->name(),
                'reason' => $e->context['reason'] ?? $e->context['status'] ?? $e->getMessage(),
            ]);
            $this->used = $this->fallback;

            return $this->fallback->transcribe($audioFilePath, $language, $options);
        }
    }
}
