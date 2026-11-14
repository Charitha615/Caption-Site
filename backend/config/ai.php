<?php

/*
|--------------------------------------------------------------------------
| AI transcription
|--------------------------------------------------------------------------
|
| provider: 'gemini' (production) or 'fake' (deterministic sample captions).
| When GEMINI_API_KEY is empty outside production, the fake provider is used
| automatically so the app runs end-to-end locally. In production a missing key
| makes caption generation fail with a clear message — it never fabricates text.
|
*/

return [
    'provider' => env('AI_PROVIDER', 'gemini'),

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.8-flash'),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
        'upload_url' => env('GEMINI_UPLOAD_URL', 'https://generativelanguage.googleapis.com/upload/v1beta'),
        'timeout' => (int) env('GEMINI_TIMEOUT', 300),
        // Audio up to this size is sent inline; larger files use the Files API.
        'inline_max_bytes' => (int) env('GEMINI_INLINE_MAX_BYTES', 15 * 1024 * 1024),
        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 65536),
    ],
];
