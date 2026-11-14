<?php

/*
|--------------------------------------------------------------------------
| Plans and usage limits
|--------------------------------------------------------------------------
|
| Every user has a `plan` (users.plan, default below). Limits are enforced by
| App\Services\Usage\UsageService and reported by GET /api/usage. A future
| billing integration only needs to set users.plan — nothing else changes.
| Use null for "unlimited".
|
*/

return [
    'default' => env('DEFAULT_PLAN', 'free'),

    'plans' => [
        'free' => [
            'label' => 'Free',
            'caption_minutes_per_month' => (int) env('FREE_CAPTION_MINUTES', 120),
            'ai_requests_per_day' => (int) env('FREE_AI_REQUESTS_PER_DAY', 30),
            'exports_per_month' => 300,
            'renders_per_month' => 30,
            'storage_mb' => (int) env('FREE_STORAGE_MB', 5120),
            'max_upload_mb' => (int) env('MAX_UPLOAD_MB', 500),
            'max_video_minutes' => 30,
            'concurrent_renders' => 2,
        ],
        'pro' => [
            'label' => 'Pro',
            'caption_minutes_per_month' => 1200,
            'ai_requests_per_day' => 300,
            'exports_per_month' => null,
            'renders_per_month' => 300,
            'storage_mb' => 102400,
            'max_upload_mb' => 4096,
            'max_video_minutes' => 180,
            'concurrent_renders' => 4,
        ],
        // Internal accounts: no limits (still tracked).
        'unlimited' => [
            'label' => 'Unlimited',
            'caption_minutes_per_month' => null,
            'ai_requests_per_day' => null,
            'exports_per_month' => null,
            'renders_per_month' => null,
            'storage_mb' => null,
            'max_upload_mb' => 8192,
            'max_video_minutes' => null,
            'concurrent_renders' => 6,
        ],
    ],
];
