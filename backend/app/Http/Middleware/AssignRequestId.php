<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives every request a correlation id: echoed as X-Request-Id, attached to all log
 * entries (and queued jobs, via Context), and included in error responses so a user
 * can quote it to support.
 */
class AssignRequestId
{
    public function handle(Request $request, Closure $next): Response
    {
        $incoming = (string) $request->header('X-Request-Id');
        $id = preg_match('/^[A-Za-z0-9\-]{8,64}$/', $incoming) ? $incoming : (string) Str::uuid();

        Context::add('request_id', $id);
        if ($request->user()) {
            Context::add('user', $request->user()->uuid);
        }

        $response = $next($request);
        $response->headers->set('X-Request-Id', $id);

        return $response;
    }
}
