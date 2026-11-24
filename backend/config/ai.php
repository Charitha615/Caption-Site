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
    // Seconds of silence put before the audio sent for transcription (removed again from the
    // timings). Speech models often drop words spoken in the very first instant of a file.
    'audio_lead_in_seconds' => (float) env('AI_AUDIO_LEAD_IN', 1.0),

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
        // Clean-up is optional polish: give up quickly when the text model is slow.
        'cleanup_timeout' => (int) env('GEMINI_CLEANUP_TIMEOUT', 45),
        // Mixed-script transcription (like sincap.cc / AutoSubs-Gemini): a prompted Flash model writes
        // each ~30 s part's words, Sinhala in Sinhala letters and English in English letters; the
        // transcribe model above only supplies the word timings these words are lined up with.
        'mixed_transcription' => (bool) env('GEMINI_MIXED_TRANSCRIPTION', true),
        'mixed_models' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_MIXED_MODELS', 'gemini-3.5-flash,gemini-3.6-flash'))))),
        'mixed_timeout' => (int) env('GEMINI_MIXED_TIMEOUT', 60),
        // Listening review: after each audio part is transcribed, the text model hears that part
        // and corrects its lines (misheard Sinhala, English words, missing words).
        'caption_review' => (bool) env('GEMINI_CAPTION_REVIEW', true),
        'review_timeout' => (int) env('GEMINI_REVIEW_TIMEOUT', 60),
        'review_max_bytes' => (int) env('GEMINI_REVIEW_MAX_BYTES', 8 * 1024 * 1024),
        // Label speakers (spk_1, spk_2 …) in the transcript.
        'diarization' => (bool) env('GEMINI_DIARIZATION', true),
        // Audio is transcribed and reviewed in parts of about this many seconds, cut at natural
        // pauses. Short parts are more accurate (fewer skipped/misheard words) and each one is
        // reviewed against its own audio before moving on. Max 1800 (30 min per request).
        'transcribe_chunk_seconds' => (int) env('GEMINI_TRANSCRIBE_CHUNK_SECONDS', 30),
        'base_url' => env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
        'upload_url' => env('GEMINI_UPLOAD_URL', 'https://generativelanguage.googleapis.com/upload/v1beta'),
        // Seconds to wait for one model's answer. A 2–3 minute video normally takes well under a minute; overloads are retried by the job.
        'timeout' => (int) env('GEMINI_TIMEOUT', 120),
        // Tried in order when the main model is overloaded or times out (comma-separated).
        'fallback_models' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEMINI_FALLBACK_MODELS', 'gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash'))))),
        // Model "thinking" for transcription: low (fast, default), high, or default (model's own).
        'thinking' => env('GEMINI_THINKING', 'low'),
        // Audio up to this size is sent inline; larger files use the Files API.
        'inline_max_bytes' => (int) env('GEMINI_INLINE_MAX_BYTES', 15 * 1024 * 1024),
        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 65536),
        // Ask Gemini for per-word timings (slower, larger responses). When false, word timings
        // for karaoke/highlight effects are estimated from each caption line.
        'word_timings' => (bool) env('GEMINI_WORD_TIMINGS', false),
    ],

    // Final correction pass over generated captions (the platform's key, for every user):
    // Sinhala spelling and English words written in English letters. Off when the key is empty.
    'openai' => [
        'api_key' => env('OPENAI_API_KEY'),
        'caption_correction' => (bool) env('OPENAI_CAPTION_CORRECTION', true),
        'model' => env('OPENAI_MODEL', 'gpt-5.5'),
        // Reasoning models only (gpt-5 family); leave empty for models without reasoning.
        'reasoning_effort' => env('OPENAI_REASONING_EFFORT', 'low'),
        'timeout' => (int) env('OPENAI_TIMEOUT', 60),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
    ],
];
