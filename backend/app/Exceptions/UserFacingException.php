<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

/**
 * An error whose message is safe to show to end users.
 *
 * Technical detail (FFmpeg stderr, provider responses, file paths) goes into
 * $context, which is logged server-side and never sent to the client.
 */
class UserFacingException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly array $context = [],
        public readonly int $status = 422,
        public readonly string $errorCode = 'request_failed',
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }
}
