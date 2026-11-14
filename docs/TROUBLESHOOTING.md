# Troubleshooting

Start with the structured log — it has the technical detail users never see:

```bash
tail -n 50 backend/storage/logs/events-$(date +%F).log | jq '{t: .datetime, e: .context.event, r: .context.request_id, ctx: .context}'
```

If a user reports an error with a reference ("Ref: 6b1c2d3e"), search for it: `grep 6b1c2d3e backend/storage/logs/*.log`.

## Uploads

| Symptom | Cause / fix |
|---|---|
| Upload stays at 0% or fails right away | API unreachable or CORS: check `VITE_API_URL`, and that `CORS_ALLOWED_ORIGINS` includes the exact web origin (scheme + port). |
| "Chunk must be exactly N bytes" / HTTP 413 | A proxy limits body size. Raise Nginx `client_max_body_size` and PHP `post_max_size` above `UPLOAD_CHUNK_SIZE`. |
| "This file is not a supported video" | The bytes are not a recognised video container (renamed file, corrupted export). Re-export as MP4 (H.264/AAC). Event: `upload.rejected_mime`. |
| "Videos on your plan can be up to … MB" (402) | Plan limit — see `config/plans.php` / `MAX_UPLOAD_MB`. |
| Upload resumes from the start | Resume matches the **same file name and size** within `UPLOAD_SESSION_TTL_HOURS`. |
| Disk fills with `storage/app/chunks` | The scheduler isn't running (`uploads:prune`). Add the cron entry. |

## Processing / captions

| Symptom | Cause / fix |
|---|---|
| Project stuck on a processing step for a long time | The worker was stopped or crashed mid-job. `projects:reset-stuck` (scheduled every 10 min) marks it failed after the job timeout so **Retry** appears; run it by hand with `php artisan projects:reset-stuck --minutes=0`. |
| Transcription is slow | Gemini time grows with video length; the screen shows elapsed time. Keep `GEMINI_WORD_TIMINGS=false` (default) — asking for per-word timings is much slower. |
| Project stuck on "Uploaded" | No worker on the `default` queue. Run `./dev.sh`, `php artisan queue:work --queue=default,renders`, or Horizon. Check `php artisan queue:failed`. |
| "Video processing is temporarily unavailable" | FFmpeg/FFprobe not found. Set `FFMPEG_BINARY` / `FFPROBE_BINARY`; test `$FFPROBE_BINARY -version` as the worker user. Event: `ffmpeg.unavailable`. |
| "This video has no audio track" | The file really has no audio stream. |
| "Add your Google AI API key in Account & usage" | The user has no key saved. They create one at https://aistudio.google.com/app/api-keys and paste it on the Account page. (Or set `AI_ALLOW_SERVER_KEY=true` to use the server key.) |
| "Google rejected this key" when saving | Key copied incompletely, deleted in AI Studio, or the Gemini API isn't enabled for its Google Cloud project. |
| "This key works, but it cannot use the … model" | The key's project has no access to `GEMINI_MODEL`. Enable it, or pick a model the key can use. |
| "Google rejected your AI API key… retry" during processing | The saved key stopped working (revoked/quota project disabled). Replace it on the Account page, then Retry on the project. |
| "Your Google AI key has run out of quota" | The user's own Google quota/billing limit. They check it in Google AI Studio. |
| Saved keys stopped working after a deploy | `APP_KEY` changed — encrypted keys can't be decrypted. Restore the old key or ask users to re-enter theirs. |
| "AI captioning is not configured" | Only with `AI_ALLOW_SERVER_KEY=true` and an empty `GEMINI_API_KEY`. |
| "Google’s AI is overloaded right now" | Google returned 503 "high demand" (or timed out) for the main model **and** every `GEMINI_FALLBACK_MODELS` entry. It is temporary — press Retry later, or add another fallback model. Events: `ai.model_unavailable`, `ai.timeout`. |
| "The AI service is busy…" | Gemini returned 429 (quota). Check your Google quota; event `ai.request_failed` has `status`. |
| "AI captioning is temporarily unavailable" | Gemini 401/403: wrong key, key restricted to other APIs, or model not enabled. |
| Captions came from `gemini-3.8-flash`, not the transcribe model | Look for `ai.transcriber_fallback` in the event log: the speech model was unavailable for the key (Verify on Account & usage says so), overloaded, rejected the language, or returned no word timings. |
| Punctuation wasn't cleaned | `GEMINI_CAPTION_CLEANUP=false`, or the clean-up answer was rejected (`ai.cleanup_mismatch` / `ai.cleanup_failed`) — captions then stay exactly as transcribed. |
| "This video has too much speech to caption in one pass" | Output hit `GEMINI_MAX_OUTPUT_TOKENS`. Use a shorter clip or raise the limit if the model allows it. |
| Captions are sample sentences ("no AI key is configured") | Running with `AI_PROVIDER=fake` or no key outside production. Set the key. |
| Changes to PHP code have no effect on jobs | Workers cache code. `php artisan queue:restart` / `horizon:terminate`. |

## Editor

| Symptom | Cause / fix |
|---|---|
| "Connection problem — the request timed out" while the editor is open | `php artisan serve` handled one request at a time, so the video stream blocked other calls. `./dev.sh` now starts 6 workers (`PHP_CLI_SERVER_WORKERS`). If you run `php artisan serve` yourself, use `PHP_CLI_SERVER_WORKERS=6 php artisan serve --no-reload`. Production (Nginx + PHP-FPM) is not affected. |

| Symptom | Cause / fix |
|---|---|
| Video won't seek | Use the signed stream URL from the API (it supports Range). Proxies must pass the `Range` header through. |
| Video stops loading after many hours | Signed URLs expire (`MEDIA_STREAM_TTL`, default 12 h). Reload the editor. |
| "Save failed" in the top bar | Autosave retries automatically (3 s, 10 s, 30 s). Persistent failures: check network, 422s in the browser console (caption text > 2000 chars, > 5000 captions, settings > 256 KB). |
| Sinhala characters look broken | The browser lacks Noto Sans Sinhala (Google Fonts blocked). Allow `fonts.googleapis.com` / `fonts.gstatic.com` in your CSP or self-host the font. |

## Exports

| Symptom | Cause / fix |
|---|---|
| MP4 stays "Queued" | No worker on the `renders` queue (`RENDER_QUEUE`). |
| "This FFmpeg build has no libass" | Install a full build (`brew install ffmpeg-full`, Debian 12+/Ubuntu 24.04 `ffmpeg`). |
| Sinhala renders as boxes in the MP4 | Fonts not installed: `php artisan captions:install-fonts` (needs internet once); check `CAPTION_FONTS_PATH`. |
| "Rendering took too long" | Raise `RENDER_TIMEOUT` (and Horizon `renders` timeout follows it), or choose a smaller resolution/quality. |
| Download link says "invalid or has expired" | Signed links last `EXPORT_DOWNLOAD_TTL` minutes; the UI fetches a fresh one on each click. Clock skew between servers also breaks signatures — use NTP. |
| Sinhala SRT shows "?" in a desktop player | Files are UTF-8. Choose UTF-8 encoding in the player's subtitle settings. |

## Auth & API

| Symptom | Cause / fix |
|---|---|
| Logged out unexpectedly | Token expired (`SANCTUM_TOKEN_EXPIRATION`) or password changed on another device. |
| 429 on login | 5 attempts/minute per email+IP. Wait a minute. |
| Every request 401 after deploy | `APP_KEY` changed? Tokens survive key changes, but signed URLs do not. Check the `personal_access_tokens` table and the `Authorization` header passing through your proxy. |
| Signed URLs point to `http://` behind a load balancer | Set `APP_URL=https://…` and `TRUSTED_PROXIES`. |
| `/horizon` returns 401/403 | Set `HORIZON_BASIC_AUTH_USER/PASSWORD` (non-local environments). |

## Tests

| Symptom | Fix |
|---|---|
| Backend tests try to reach the network | They must not: `phpunit.xml` forces `AI_PROVIDER=fake` and `Http::preventStrayRequests()` fails the test. Fake the call with `Http::fake()`. |
| `php artisan test` uses your real DB | Run `php artisan config:clear` first — a cached config overrides `phpunit.xml`. |
