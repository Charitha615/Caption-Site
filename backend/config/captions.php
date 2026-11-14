<?php

/*
|--------------------------------------------------------------------------
| Caption styling, fonts and rendering
|--------------------------------------------------------------------------
|
| The browser editor and the MP4 renderer share one style model (see
| docs/ARCHITECTURE.md §8). Font families are identified by the same CSS
| value the editor stores, e.g. '"Noto Sans Sinhala", sans-serif'.
|
*/

return [

    // FFmpeg must be built with libass (+HarfBuzz) to burn styled captions.
    // macOS: brew install ffmpeg-full → /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
    // Debian/Ubuntu: apt install ffmpeg
    'ffmpeg_binary' => env('FFMPEG_BINARY', 'ffmpeg'),
    'ffprobe_binary' => env('FFPROBE_BINARY', 'ffprobe'),

    // Queue for MP4 renders. Use a dedicated queue in production so long renders
    // don't block AI captioning: php artisan queue:work --queue=renders,default
    'render_queue' => env('RENDER_QUEUE', 'default'),
    'render_timeout' => (int) env('RENDER_TIMEOUT', 3600),

    // Fonts burned into videos. Installed by `php artisan captions:install-fonts`.
    'fonts_path' => env('CAPTION_FONTS_PATH', storage_path('app/fonts')),

    'presets_path' => resource_path('captions/presets.json'),

    // PRIVATE disk for uploaded source videos, extracted audio and thumbnails.
    // 'local' (storage/app/private) or an object-storage disk such as 's3'.
    // Clients only ever reach these files through short-lived signed URLs.
    'media_disk' => env('MEDIA_DISK', 'local'),
    'stream_url_ttl_minutes' => (int) env('MEDIA_STREAM_TTL', 720),

    // Chunked, resumable uploads (see App\Http\Controllers\Api\UploadSessionController).
    // Keep chunk_size below PHP's post_max_size.
    'uploads' => [
        'chunk_size' => (int) env('UPLOAD_CHUNK_SIZE', 5 * 1024 * 1024),
        'session_ttl_hours' => (int) env('UPLOAD_SESSION_TTL_HOURS', 24),
        'extensions' => ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
        // Detected server-side from file contents (never trusted from the client).
        'mime_types' => [
            'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
            'video/x-msvideo', 'video/avi', 'video/msvideo', 'video/x-m4v', 'audio/mp4',
        ],
    ],

    // Storage disk for exported files. Must be PRIVATE — downloads go through signed URLs.
    'export_disk' => env('EXPORT_DISK', 'local'),
    'download_url_ttl_minutes' => (int) env('EXPORT_DOWNLOAD_TTL', 30),

    'export_types' => ['srt', 'vtt', 'txt', 'json', 'mp4'],

    // Output short side in pixels. 2160 (4K) is only allowed when the source is at least that big.
    'resolutions' => [
        '720' => 720,
        '1080' => 1080,
        '2160' => 2160,
    ],

    'qualities' => [
        'high' => ['crf' => 18, 'preset' => 'slow', 'audio_bitrate' => '192k'],
        'standard' => ['crf' => 22, 'preset' => 'medium', 'audio_bitrate' => '160k'],
        'small' => ['crf' => 27, 'preset' => 'veryfast', 'audio_bitrate' => '128k'],
    ],

    /*
    | key   = CSS font-family value stored in caption styles
    | family = exact family name inside the font files (used by libass)
    | script = 'sinhala' | 'latin'
    | google = Google Fonts css2 family spec used by captions:install-fonts (static instances)
    */
    'fonts' => [
        '"Noto Sans Sinhala", sans-serif' => ['family' => 'Noto Sans Sinhala', 'script' => 'sinhala', 'google' => 'Noto Sans Sinhala:wght@400;500;600;700;800;900'],
        '"Noto Serif Sinhala", serif' => ['family' => 'Noto Serif Sinhala', 'script' => 'sinhala', 'google' => 'Noto Serif Sinhala:wght@400;500;600;700;800;900'],
        '"Abhaya Libre", serif' => ['family' => 'Abhaya Libre', 'script' => 'sinhala', 'google' => 'Abhaya Libre:wght@400;500;600;700;800'],
        '"Yaldevi", sans-serif' => ['family' => 'Yaldevi', 'script' => 'sinhala', 'google' => 'Yaldevi:wght@400;500;600;700'],
        '"Gemunu Libre", sans-serif' => ['family' => 'Gemunu Libre', 'script' => 'sinhala', 'google' => 'Gemunu Libre:wght@400;500;600;700;800'],
        '"Inter", sans-serif' => ['family' => 'Inter', 'script' => 'latin', 'google' => 'Inter:wght@400;500;600;700;800;900'],
        '"Poppins", sans-serif' => ['family' => 'Poppins', 'script' => 'latin', 'google' => 'Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700;1,800;1,900'],
        '"Montserrat", sans-serif' => ['family' => 'Montserrat', 'script' => 'latin', 'google' => 'Montserrat:wght@400;500;600;700;800;900'],
        '"Roboto", sans-serif' => ['family' => 'Roboto', 'script' => 'latin', 'google' => 'Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400;1,500;1,700;1,900'],
        '"Merriweather", serif' => ['family' => 'Merriweather', 'script' => 'latin', 'google' => 'Merriweather:ital,wght@0,400;0,700;0,900;1,400;1,700;1,900'],
        '"Courier New", monospace' => ['family' => 'Courier New', 'script' => 'latin', 'google' => null],
    ],

    'default_sinhala_font' => '"Noto Sans Sinhala", sans-serif',
    'default_latin_font' => '"Inter", sans-serif',
];
