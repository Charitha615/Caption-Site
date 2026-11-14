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

    // Each user brings their own Google AI key (Account & usage). When true, users
    // without a key fall back to GEMINI_API_KEY (the server's key) instead of being
    // asked to add one. Keep false unless the platform pays for everyone's AI usage.
    'allow_server_key' => (bool) env('AI_ALLOW_SERVER_KEY', false),

    // Where users create a key (linked from the Account page).
    'key_help_url' => 'https://aistudio.google.com/app/api-keys',

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        // Speech → timed words. Purpose-built transcription model (Interactions API).
        'transcribe_model' => env('GEMINI_TRANSCRIBE_MODEL', 'gemini-3.5-transcribe'),
        // Text model: caption cleanup/punctuation/formatting, and the fallback transcriber
        // when the transcription model is unavailable. GEMINI_MODEL is the legacy name.
        'model' => env('GEMINI_TEXT_MODEL', env('GEMINI_MODEL', 'gemini-3.8-flash')),
        // Run the text model over transcribed captions (punctuation, spacing, Sinhala Unicode
        // fixes). Never changes timing; the raw transcript is always kept.
        'caption_cleanup' => (bool) env('GEMINI_CAPTION_CLEANUP', true),
        // Label speakers (spk_1, spk_2 …) in the transcript.
        'diarization' => (bool) env('GEMINI_DIARIZATION', true),
        // Gemini 3.5 Transcribe allows 30 min per request with word timestamps; longer audio
        // is split into chunks of this many seconds and stitched back together.
        'transcribe_chunk_seconds' => (int) env('GEMINI_TRANSCRIBE_CHUNK_SECONDS', 1500),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
        'upload_url' => env('GEMINI_UPLOAD_URL', 'https://generativelanguage.googleapis.com/upload/v1beta'),
        // Seconds to wait for one model's answer. A 2–3 minute video normally takes well under a minute; overloads are retried by the job.
        'timeout' => (int) env('GEMINI_TIMEOUT', 120),
        // Tried in order when the main model is overloaded or times out (comma-separated).
        'fallback_models' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_FALLBACK_MODELS', 'gemini-flash-latest'))))),
        // Model "thinking" for transcription: low (fast, default), high, or default (model's own).
        'thinking' => env('GEMINI_THINKING', 'low'),
        // Audio up to this size is sent inline; larger files use the Files API.
        'inline_max_bytes' => (int) env('GEMINI_INLINE_MAX_BYTES', 15 * 1024 * 1024),
        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 65536),
        // Ask Gemini for per-word timings (slower, larger responses). When false, word timings
        // for karaoke/highlight effects are estimated from each caption line.
        'word_timings' => (bool) env('GEMINI_WORD_TIMINGS', false),
    ],
];
