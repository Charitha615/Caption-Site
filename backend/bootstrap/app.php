<?php

use App\Exceptions\UserFacingException;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\SecurityHeaders;
use App\Support\AppLog;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);
        $middleware->append(SecurityHeaders::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Expected, user-caused errors: shown to the user, not reported as bugs.
        $exceptions->dontReport([UserFacingException::class]);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $json = function (Request $request, int $status, string $message, array $extra = []) {
            return response()->json(array_merge([
                'success' => false,
                'message' => $message,
                'data' => (object) [],
            ], $extra, ['request_id' => Context::get('request_id')]), $status, ['Content-Type' => 'application/json; charset=utf-8'], JSON_UNESCAPED_UNICODE);
        };
        $wantsJson = fn (Request $request) => $request->is('api/*') || $request->expectsJson();

        $exceptions->render(function (UserFacingException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                return $json($request, $e->status, $e->getMessage(), ['code' => $e->errorCode]);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                return $json($request, 401, 'Unauthenticated. Please log in.', ['code' => 'unauthenticated']);
            }
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                AppLog::warning('auth.access_denied', ['path' => $request->path(), 'method' => $request->method(), 'ip' => $request->ip()]);

                return $json($request, 403, 'Access denied. You do not have permission to perform this action.', ['code' => 'forbidden']);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                return $json($request, 404, 'The requested resource was not found.', ['code' => 'not_found']);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                return $json($request, 422, $e->getMessage() ?: 'Validation failed.', ['code' => 'validation_failed', 'errors' => $e->errors()]);
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                return $json($request, 429, 'Too many requests. Please wait a moment and try again.', ['code' => 'rate_limited'])
                    ->withHeaders(array_intersect_key($e->getHeaders(), array_flip(['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'])));
            }
        });

        // Any other HTTP exception (e.g. 403 invalid/expired signed URL, 409, 405, 413) keeps its status.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                $status = $e->getStatusCode();
                $message = match ($status) {
                    403 => 'This link is invalid or has expired.',
                    405 => 'Method not allowed.',
                    413 => 'The upload is too large.',
                    default => $status < 500 && $e->getMessage() ? $e->getMessage() : 'Request could not be completed.',
                };

                return $json($request, $status, $message, ['code' => 'http_'.$status]);
            }
        });

        // Unexpected errors: generic message for users; details only in logs (and in local debug mode).
        $exceptions->render(function (Throwable $e, Request $request) use ($json, $wantsJson) {
            if ($wantsJson($request)) {
                $debug = config('app.debug') && ! app()->isProduction();

                return $json($request, 500, $debug ? $e->getMessage() : 'Something went wrong on our side. Please try again.', ['code' => 'server_error']);
            }
        });
    })->create();
