<?php

namespace App\Providers;

use App\Http\Middleware\HorizonBasicAuth;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\HorizonApplicationServiceProvider;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * The API is token-based (no web sessions), so the dashboard is protected by
     * HTTP Basic credentials from HORIZON_BASIC_AUTH_USER / HORIZON_BASIC_AUTH_PASSWORD.
     * Without them configured, Horizon is reachable only in the local environment.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', fn ($user = null) => HorizonBasicAuth::passes(request()));
    }
}
