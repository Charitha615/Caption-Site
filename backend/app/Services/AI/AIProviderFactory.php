<?php

namespace App\Services\AI;

use App\Exceptions\AIKeyRequiredException;
use App\Models\User;

/**
 * Chooses the AI provider for a user's request.
 *
 * - AI_PROVIDER=fake → the container's provider (sample captions; used by tests).
 * - Otherwise Gemini with the **user's own key** (Account & usage).
 * - Without a user key, the server key is used only if AI_ALLOW_SERVER_KEY=true;
 *   else AIKeyRequiredException asks the user to add one.
 */
class AIProviderFactory
{
    public function usesUserKeys(): bool
    {
        return config('ai.provider') !== 'fake';
    }

    /** Whether this user can start AI captioning right now. */
    public function canCaption(User $user): bool
    {
        return ! $this->usesUserKeys()
            || $user->hasAiKey()
            || (config('ai.allow_server_key') && ! empty(config('ai.gemini.api_key')));
    }

    public function ensureCanCaption(User $user): void
    {
        if (! $this->canCaption($user)) {
            throw new AIKeyRequiredException;
        }
    }

    /**
     * Speech-to-text for this user: Gemini 3.5 Transcribe (GEMINI_TRANSCRIBE_MODEL) with an
     * automatic fallback to the text model (GEMINI_TEXT_MODEL) transcribing directly.
     */
    public function forUser(User $user): AIProviderInterface
    {
        if (! $this->usesUserKeys()) {
            return app(AIProviderInterface::class);
        }
        [$key, $isUserKey] = $this->keyFor($user);
        $textTranscriber = new GeminiAIProvider(apiKey: $key, isUserKey: $isUserKey);

        if (! config('ai.gemini.transcribe_model')) {
            return $textTranscriber;
        }

        return new FallbackTranscriber(new GeminiTranscribeProvider(apiKey: $key, isUserKey: $isUserKey), $textTranscriber);
    }

    /** Caption clean-up (punctuation/formatting) with the text model, or a no-op. */
    public function refinerForUser(User $user): CaptionRefinerInterface
    {
        if (! $this->usesUserKeys() || ! config('ai.gemini.caption_cleanup', true)) {
            return new NullCaptionRefiner;
        }

        return new GeminiCaptionRefiner($this->keyFor($user)[0]);
    }

    /** @return array{0: string, 1: bool} */
    private function keyFor(User $user): array
    {
        if ($user->hasAiKey()) {
            return [(string) $user->gemini_api_key, true];
        }
        if (config('ai.allow_server_key') && ! empty(config('ai.gemini.api_key'))) {
            return [(string) config('ai.gemini.api_key'), false];
        }

        throw new AIKeyRequiredException;
    }
}
