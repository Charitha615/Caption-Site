<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Please log in.',
                    'data' => (object) [],
                ], 401, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied. You do not have permission to perform this action.',
                    'data' => (object) [],
                ], 403, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'The requested resource was not found.',
                    'data' => (object) [],
                ], 404, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'Validation failed.',
                    'data' => (object) [],
                    'errors' => $e->errors(),
                ], 422, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many requests. Please wait a moment and try again.',
                    'data' => (object) [],
                ], 429, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $isDebug = config('app.debug', false);
                return response()->json([
                    'success' => false,
                    'message' => $isDebug ? $e->getMessage() : 'An internal server error occurred.',
                    'data' => (object) [],
                ], 500, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
            }
        });
    })->create();
