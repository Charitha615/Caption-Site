<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponseTrait
{
    /**
     * Send a standardized success JSON response.
     */
    protected function successResponse(mixed $data = null, string $message = 'Success', int $statusCode = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data ?? (object) [],
        ], $statusCode, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Send a standardized error JSON response.
     */
    protected function errorResponse(string $message = 'An error occurred', int $statusCode = 400, mixed $errors = null): JsonResponse
    {
        $payload = [
            'success' => false,
            'message' => $message,
            'data' => (object) [],
        ];

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $statusCode, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
    }
}
