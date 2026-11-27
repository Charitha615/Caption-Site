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
    | Fully Unicode / Sinhala compliant (e.g. "සිංසබ්").
    |
    */

    'name' => env('BRAND_NAME', env('APP_NAME', 'Sinsub')),
    'short_name' => env('BRAND_SHORT_NAME', env('BRAND_NAME', env('APP_NAME', 'Sinsub'))),
    // Logo text (Sinhala name).
    'logo_text' => env('BRAND_LOGO_TEXT', 'සිංසබ්'),
    // Name in titles and the watermark on free-plan videos (Sinhala + English).
    'title_name' => env('BRAND_TITLE_NAME', 'සිංSub'),
    'domain' => env('BRAND_DOMAIN', 'sinsub.lk'),
    'tagline' => env('BRAND_TAGLINE', 'Sinhala & English video captions'),
    'description' => env('BRAND_DESCRIPTION', 'Create, edit and export Sinhala and English captions for your videos.'),
    'support_email' => env('BRAND_SUPPORT_EMAIL', 'support@sinsub.lk'),
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
