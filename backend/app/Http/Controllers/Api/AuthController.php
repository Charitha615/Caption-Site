<?php

namespace App\Http\Controllers\Api;

use App\Actions\Auth\LoginUserAction;
use App\Actions\Auth\RegisterUserAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected RegisterUserAction $registerAction,
        protected LoginUserAction $loginAction,
    ) {}

    /**
     * Register a new user account.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->registerAction->execute($request->validated());

        return $this->successResponse([
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ], 'Registration successful', 201);
    }

    /**
     * Authenticate and issue an API token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->loginAction->execute($request->validated());

        return $this->successResponse([
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ], 'Login successful');
    }

    /**
     * Revoke the current user token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->successResponse(null, 'Logged out successfully');
    }

    /**
     * Return authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        return $this->successResponse([
            'user' => new UserResource($request->user()),
        ], 'User profile retrieved');
    }
}
