<?php

namespace App\Exceptions;

/** The user's plan does not allow this action right now. Rendered as HTTP 402. */
class UsageLimitExceededException extends UserFacingException
{
    public function __construct(string $message, public readonly string $limit, array $context = [])
    {
        parent::__construct($message, ['limit' => $limit] + $context, 402, 'usage_limit_exceeded');
    }
}
