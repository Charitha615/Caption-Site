<?php

/*
|--------------------------------------------------------------------------
| Plans, limits and Pro features
|--------------------------------------------------------------------------
|
| Every user has a `plan` (users.plan, default below). A paid plan also has an end
| date (users.plan_expires_at); after it the user is on the default plan again.
| Limits are enforced by App\Services\Usage\UsageService and reported by GET /api/usage.
| Use null for "unlimited".
|
| Features (true = included):
|   max_export_height  tallest MP4 export (short side, px): 720 = HD, 2160 = 4K
|   watermark          a small brand mark on exported videos
|   premium_styles     word-by-word highlight caption styles (Spotlight, Hormozi, Word Box, TikTok)
|   editor_ai          AI tools in the video editor (voice-over, clean-up, script writer…)
|   priority_support   WhatsApp support
|
| Prices are in config/billing.php. The pricing cards (frontend/src/config/pricing.ts) mirror this file.
|
*/

return [
    'default' => env('DEFAULT_PLAN', 'free'),

    /** Caption animations that need `premium_styles` (the word-by-word highlight effects). */
    'premium_animations' => ['karaoke', 'highlight'],

    'plans' => [
        'free' => [
            'label' => 'Free',
            'caption_minutes_per_month' => (int) env('FREE_CAPTION_MINUTES', 30),
            'ai_requests_per_day' => (int) env('FREE_AI_REQUESTS_PER_DAY', 30),
            'exports_per_month' => 300,
            'renders_per_month' => 30,
            'storage_mb' => (int) env('FREE_STORAGE_MB', 2048),
            'max_upload_mb' => (int) env('MAX_UPLOAD_MB', 500),
            'max_video_minutes' => (int) env('FREE_MAX_VIDEO_MINUTES', 10),
            'concurrent_renders' => 2,
            'features' => [
                'max_export_height' => 720,
                'watermark' => true,
                'premium_styles' => false,
                'editor_ai' => false,
                'priority_support' => false,
            ],
        ],
        'pro' => [
            'label' => 'Pro',
            'caption_minutes_per_month' => (int) env('PRO_CAPTION_MINUTES', 600),
            'ai_requests_per_day' => 300,
            'exports_per_month' => null,
            'renders_per_month' => 300,
            'storage_mb' => (int) env('PRO_STORAGE_MB', 51200),
            'max_upload_mb' => 4096,
            'max_video_minutes' => 180,
            'concurrent_renders' => 3,
            'features' => [
                'max_export_height' => 2160,
                'watermark' => false,
                'premium_styles' => true,
                'editor_ai' => true,
                'priority_support' => true,
            ],
        ],
        // Internal accounts (set by hand): no limits (still tracked), never shown for sale.
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
            'features' => [
                'max_export_height' => 2160,
                'watermark' => false,
                'premium_styles' => true,
                'editor_ai' => true,
                'priority_support' => true,
            ],
        ],
    ],
];
