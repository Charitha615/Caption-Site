<?php

namespace App\Services\AI;

use App\Support\AppLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Checks a Google AI (Gemini) key by fetching the configured model's metadata —
 * a free call that proves the key works *and* can use the model we need.
 * The key travels only in the `x-goog-api-key` header and is never logged.
 */
class GeminiKeyVerifier
{
    public const VALID = 'valid';

    public const INVALID = 'invalid';

    public const UNREACHABLE = 'unreachable';

    /** @return array{result: string, message: string} */
    public function verify(string $apiKey): array
    {
        $base = rtrim((string) config('ai.gemini.base_url'), '/');
        $model = (string) config('ai.gemini.model');

        try {
            $response = Http::acceptJson()
                ->withHeaders(['x-goog-api-key' => $apiKey])
                ->timeout(15)
                ->get("{$base}/models/{$model}");
        } catch (ConnectionException $e) {
            AppLog::warning('ai.key_verify_unreachable', ['error' => $e->getMessage()]);

            return ['result' => self::UNREACHABLE, 'message' => 'Could not reach Google to check the key. It was saved — try Verify again in a moment.'];
        }

        $status = $response->status();
        if ($response->successful()) {
            return ['result' => self::VALID, 'message' => 'Key verified. '.$this->transcribeModelNote($apiKey, $base)];
        }
        if ($status === 429) {
            // Google recognised the key; it is only out of quota right now.
            return ['result' => self::VALID, 'message' => 'Key accepted, but its quota is exhausted right now. Check your limits in Google AI Studio.'];
        }
        if ($status === 404) {
            return ['result' => self::INVALID, 'message' => "This key works, but it cannot use the {$model} model. Enable the Gemini API for its project in Google AI Studio."];
        }
        if (in_array($status, [400, 401, 403], true)) {
            return ['result' => self::INVALID, 'message' => 'Google rejected this key. Copy it again from Google AI Studio and make sure the Gemini API is enabled.'];
        }

        AppLog::warning('ai.key_verify_failed', ['status' => $status]);

        return ['result' => self::UNREACHABLE, 'message' => 'Google could not check the key right now. Try Verify again in a moment.'];
    }

    /** Whether the key can also use the speech model (otherwise the text model transcribes). */
    protected function transcribeModelNote(string $apiKey, string $base): string
    {
        $model = (string) config('ai.gemini.transcribe_model');
        if ($model === '') {
            return 'Captions will be generated with your Google AI key.';
        }
        try {
            $ok = Http::acceptJson()->withHeaders(['x-goog-api-key' => $apiKey])->timeout(10)->get("{$base}/models/{$model}")->successful();
        } catch (\Throwable) {
            $ok = true; // unknown — don't alarm the user
        }

        return $ok
            ? "Speech will be transcribed with {$model}."
            : "This key can't use {$model} yet, so speech will be transcribed with ".config('ai.gemini.model').' instead.';
    }

    /** True when a provider error means the key itself was refused. */
    public static function isKeyRejection(int $status, ?string $providerMessage, ?string $reason): bool
    {
        return in_array($status, [401, 403], true)
            || ($status === 400 && ($reason === 'API_KEY_INVALID' || str_contains((string) $providerMessage, 'API key not valid')));
    }
}
