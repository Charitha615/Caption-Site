<?php

namespace App\Support;

/** MIME type of an audio or video file from its extension, as Gemini expects it. */
class AudioMime
{
    public static function of(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'wav' => 'audio/wav',
            'm4a' => 'audio/mp4',
            'aac' => 'audio/aac',
            'ogg' => 'audio/ogg',
            'flac' => 'audio/flac',
            'mp4' => 'video/mp4',
            'mov' => 'video/quicktime',
            'webm' => 'video/webm',
            default => 'audio/mpeg',
        };
    }
}
