<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Centralized Brand Configuration
    |--------------------------------------------------------------------------
    |
    | Modify product naming, typography, colors, and locale defaults here.
    | Changing these values updates the entire backend branding, email
    | notifications, API brand endpoint, and metadata across the system.
    | Fully Unicode / Sinhala compliant (e.g. "පේළිCap").
    |
    */

    'name' => env('BRAND_NAME', env('APP_NAME', 'SampleCap')),
    'short_name' => env('BRAND_SHORT_NAME', env('BRAND_NAME', env('APP_NAME', 'SampleCap'))),
    'logo_text' => env('BRAND_LOGO_TEXT', env('BRAND_NAME', env('APP_NAME', 'SampleCap'))),
    'tagline' => env('BRAND_TAGLINE', 'AI-powered video captions'),
    'description' => env('BRAND_DESCRIPTION', 'Create, edit and export captions with AI.'),
    'support_email' => env('BRAND_SUPPORT_EMAIL', 'support@samplecap.com'),
    'website' => env('FRONTEND_URL', env('APP_URL', 'http://localhost:8000')),

    'colors' => [
        'primary' => '#5B21B6',
        'accent' => '#F97316',
        'dark' => '#171717',
        'background' => '#F8FAFC',
        'light_purple' => '#F5F3FF',
    ],

    'locale' => [
        'default_language' => 'si',
        'supported_languages' => [
            'si' => [
                'code' => 'si',
                'name' => 'Sinhala',
                'native' => 'සිංහල',
                'flag' => '🇱🇰',
            ],
            'en' => [
                'code' => 'en',
                'name' => 'English',
                'native' => 'English',
                'flag' => '🇺🇸',
            ],
        ],
    ],
];
