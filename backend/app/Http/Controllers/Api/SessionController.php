<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SessionResource;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The devices the signed-in user is signed in on (their API tokens), for Settings:
 * list them, sign one out, or sign out every other device.
 */
class SessionController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $sessions = $request->user()->tokens()
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->when(config('sanctum.expiration'), fn ($query, $minutes) => $query->where('created_at', '>', now()->subMinutes($minutes)))
            ->orderByRaw('COALESCE(last_used_at, created_at) DESC')
            ->get();

        return $this->successResponse(['sessions' => SessionResource::collection($sessions)]);
    }

    /** Signs out one device. Signing out the current one is the same as logging out. */
    public function destroy(Request $request, int $session): JsonResponse
    {
        $token = $request->user()->tokens()->whereKey($session)->first();
        if (! $token) {
            return $this->errorResponse('That device is already signed out.', 404);
        }

        $token->delete();
        AppLog::info('auth.session_revoked', ['user' => $request->user()->uuid, 'token' => $session]);

        return $this->successResponse(null, 'Device signed out.');
    }

    /** Signs out every device except this one. */
    public function destroyOthers(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentId = $user->currentAccessToken()?->id;
        $count = $user->tokens()->when($currentId, fn ($query) => $query->where('id', '!=', $currentId))->delete();
        AppLog::info('auth.sessions_revoked', ['user' => $user->uuid, 'count' => $count]);

        return $this->successResponse(['signed_out' => $count], $count === 1 ? '1 other device signed out.' : "{$count} other devices signed out.");
    }
}
