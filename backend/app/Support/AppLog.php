<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Structured application events, written as one JSON object per line to the
 * `structured` channel (storage/logs/events-*.log) and mirrored to the default log.
 *
 *   AppLog::error('ai.transcription_failed', ['project' => $uuid, 'status' => 503]);
 *
 * Event names are dotted: <area>.<what_happened>. Areas in use: ai, ffmpeg, upload,
 * export, render, queue, auth, http. Context passes through redact() so secrets
 * (API keys, passwords, tokens, signed URLs) are never written.
 */
class AppLog
{
    private const SENSITIVE_KEYS = ['password', 'token', 'secret', 'api_key', 'apikey', 'key', 'authorization', 'cookie', 'signature'];

    public static function info(string $event, array $context = []): void
    {
        self::write('info', $event, $context);
    }

    public static function warning(string $event, array $context = []): void
    {
        self::write('warning', $event, $context);
    }

    public static function error(string $event, array $context = [], ?Throwable $e = null): void
    {
        if ($e) {
            $context['exception'] = [
                'class' => $e::class,
                'message' => self::scrub($e->getMessage()),
                'file' => $e->getFile().':'.$e->getLine(),
            ];
        }
        self::write('error', $event, $context);
    }

    private static function write(string $level, string $event, array $context): void
    {
        $context = ['event' => $event] + self::redact($context);

        Log::channel(config('logging.structured_channel', 'structured'))->{$level}($event, $context);
    }

    public static function redact(array $context): array
    {
        foreach ($context as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), self::SENSITIVE_KEYS, true)) {
                $context[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $context[$key] = self::redact($value);
            } elseif (is_string($value)) {
                $context[$key] = self::scrub($value);
            }
        }

        return $context;
    }

    /** Removes credentials that may be embedded in URLs or messages, and caps length. */
    public static function scrub(string $value): string
    {
        $value = preg_replace('/([?&](key|signature|token|api_key)=)[^&\s"]+/i', '$1[redacted]', $value) ?? $value;
        $value = preg_replace('/AIza[0-9A-Za-z_\-]{20,}/', '[redacted-google-key]', $value) ?? $value;

        return mb_strlen($value) > 2000 ? mb_substr($value, 0, 2000).'…' : $value;
    }
}
