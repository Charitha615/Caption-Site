<?php

namespace App\Exceptions;

/** The AI transcription provider failed or returned something unusable. */
class AIProviderException extends UserFacingException
{
    public function __construct(string $message, array $context = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, $context, 502, 'ai_provider_error', $previous);
    }
}
