<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers.
    |
    */

    // The SPA authenticates with Bearer tokens (no cookies), so credentials are not
    // needed cross-origin and CSRF does not apply. Only the configured frontends may call the API.
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Comma-separated list, e.g. "https://app.example.com,https://www.example.com".
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:5173')))))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'X-Request-Id', 'Content-Range'],

    'exposed_headers' => ['X-Request-Id', 'Retry-After', 'Content-Disposition'],

    'max_age' => 3600,

    'supports_credentials' => false,

];
