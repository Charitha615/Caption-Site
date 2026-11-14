<?php

namespace App\Exceptions;

/** FFmpeg/FFprobe could not read or convert the user's video. */
class VideoProcessingException extends UserFacingException
{
    public function __construct(string $message, array $context = [], ?\Throwable $previous = null)
    {
        parent::__construct($message, $context, 422, 'video_processing_error', $previous);
    }
}
