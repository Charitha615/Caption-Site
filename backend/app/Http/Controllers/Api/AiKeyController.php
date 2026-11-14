<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AI\AIProviderFactory;
use App\Services\AI\GeminiKeyVerifier;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The signed-in user's own Google AI (Gemini) API key.
 *
 *   GET    /me/ai-key          status only (configured, last 4 chars, verified state)
 *   PUT    /me/ai-key          {api_key} → verify with Google, then store encrypted
 *   POST   /me/ai-key/verify   re-check the stored key
 *   DELETE /me/ai-key          remove it
 *
 * The key itself is never returned or logged.
 */
class AiKeyController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected GeminiKeyVerifier $verifier,
        protected AIProviderFactory $providers,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return $this->successResponse(['ai_key' => $this->payload($request->user())], 'AI key status');
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string', 'min:20', 'max:200', 'regex:/^[A-Za-z0-9_\-\.]+$/'],
        ], [
            'api_key.regex' => 'That does not look like a Google AI key. Copy it again from Google AI Studio.',
            'api_key.min' => 'That key is too short. Copy the whole key from Google AI Studio.',
        ]);
        $key = trim($validated['api_key']);
        $user = $request->user();

        $check = $this->verifier->verify($key);
        if ($check['result'] === GeminiKeyVerifier::INVALID) {
            AppLog::warning('ai.key_rejected_on_save', ['user' => $user->uuid]);
            throw ValidationException::withMessages(['api_key' => $check['message']]);
        }

        $user->forceFill([
            'gemini_api_key' => $key,
            'gemini_key_hint' => substr($key, -4),
            'gemini_key_status' => $check['result'] === GeminiKeyVerifier::VALID ? User::AI_KEY_VALID : User::AI_KEY_UNVERIFIED,
            'gemini_key_checked_at' => $check['result'] === GeminiKeyVerifier::VALID ? now() : null,
        ])->save();
        AppLog::info('ai.key_saved', ['user' => $user->uuid, 'verified' => $check['result'] === GeminiKeyVerifier::VALID]);

        return $this->successResponse(['ai_key' => $this->payload($user), 'verification' => $check], $check['message']);
    }

    public function verify(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasAiKey()) {
            return $this->errorResponse('Add a key first.', 422);
        }

        $check = $this->verifier->verify($user->gemini_api_key);
        if ($check['result'] !== GeminiKeyVerifier::UNREACHABLE) {
            $user->forceFill([
                'gemini_key_status' => $check['result'] === GeminiKeyVerifier::VALID ? User::AI_KEY_VALID : User::AI_KEY_INVALID,
                'gemini_key_checked_at' => now(),
            ])->save();
        }

        return $this->successResponse(['ai_key' => $this->payload($user), 'verification' => $check], $check['message']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->user()->forceFill([
            'gemini_api_key' => null,
            'gemini_key_hint' => null,
            'gemini_key_status' => null,
            'gemini_key_checked_at' => null,
        ])->save();
        AppLog::info('ai.key_removed', ['user' => $request->user()->uuid]);

        return $this->successResponse(['ai_key' => $this->payload($request->user())], 'AI key removed');
    }

    /** @return array<string, mixed> */
    private function payload(User $user): array
    {
        return $user->aiKeyStatus() + [
            'required' => $this->providers->usesUserKeys() && ! config('ai.allow_server_key'),
            'can_caption' => $this->providers->canCaption($user),
            'help_url' => config('ai.key_help_url'),
        ];
    }
}
