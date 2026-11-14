<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** HTTP Basic challenge in front of the Horizon dashboard (non-local environments). */
class HorizonBasicAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('local') || self::passes($request)) {
            return $next($request);
        }

        return response('Authentication required.', 401, ['WWW-Authenticate' => 'Basic realm="Horizon"']);
    }

    public static function passes(Request $request): bool
    {
        $user = (string) config('horizon.basic_auth.user');
        $password = (string) config('horizon.basic_auth.password');
        if ($user === '' || $password === '') {
            return false;
        }

        return hash_equals($user, (string) $request->getUser())
            && hash_equals($password, (string) $request->getPassword());
    }
}
