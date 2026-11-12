<?php

namespace App\Services\Rendering;

/**
 * Render failure. getMessage() is safe to show users; $details (FFmpeg stderr)
 * is for logs only — it can contain server paths.
 */
class RenderException extends \RuntimeException
{
    public function __construct(string $message, public readonly string $details = '', public readonly bool $cancelled = false)
    {
        parent::__construct($message);
    }
}
