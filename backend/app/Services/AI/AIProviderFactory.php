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

    public function forUser(User $user): AIProviderInterface
    {
        if (! $this->usesUserKeys()) {
            return app(AIProviderInterface::class);
        }
        if ($user->hasAiKey()) {
            return new GeminiAIProvider(apiKey: $user->gemini_api_key, isUserKey: true);
        }
        if (config('ai.allow_server_key') && ! empty(config('ai.gemini.api_key'))) {
            return new GeminiAIProvider;
        }

        throw new AIKeyRequiredException;
    }
}
