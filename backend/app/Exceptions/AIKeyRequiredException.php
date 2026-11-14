<?php

namespace App\Exceptions;

/** The user has not added a Google AI key (and the server key is not allowed). */
class AIKeyRequiredException extends UserFacingException
{
    public function __construct(string $message = 'Add your Google AI API key in Account & usage to generate captions.')
    {
        parent::__construct($message, [], 422, 'ai_key_required');
    }
}
