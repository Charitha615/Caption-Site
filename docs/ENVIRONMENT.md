# Environment variables

Templates: `backend/.env.example` and `frontend/.env.example`. **Never commit `.env` files** (they are git-ignored). In production run `php artisan config:cache` after changing backend variables.

## Backend (`backend/.env`)

### Application

| Variable | Example | Purpose |
|---|---|---|
| `APP_NAME` | `SampleCap` | Laravel app name (fallback for `BRAND_NAME`) |
| `APP_ENV` | `production` | `local`, `testing`, `production`. Production never uses sample AI captions |
| `APP_KEY` | `base64:…` | `php artisan key:generate`. Signs URLs — keep secret, keep stable |
| `APP_DEBUG` | `false` | Must be `false` in production |
| `APP_URL` | `https://api.example.com` | Public API origin; used in signed URLs. `https://` forces HTTPS URL generation |
| `FRONTEND_URL` | `https://app.example.com` | Web app origin |
| `CORS_ALLOWED_ORIGINS` | `https://app.example.com` | Comma-separated origins allowed to call the API (defaults to `FRONTEND_URL`) |
| `TRUSTED_PROXIES` | `*` or `10.0.0.0/8` | Load balancer IPs whose `X-Forwarded-*` headers are trusted |

### Branding

| Variable | Default | Purpose |
|---|---|---|
| `BRAND_NAME` | `APP_NAME` | Product name (Unicode OK, e.g. `පේළිCap`) |
| `BRAND_SHORT_NAME`, `BRAND_LOGO_TEXT` | `BRAND_NAME` | Variants |
| `BRAND_TAGLINE`, `BRAND_DESCRIPTION` | — | Marketing copy returned by `/api/brand` |
| `BRAND_SUPPORT_EMAIL` | `support@example.com` | Support address |

### Database

| Variable | Example | Purpose |
|---|---|---|
| `DB_CONNECTION` | `mysql` / `pgsql` | Driver |
| `DB_HOST`, `DB_PORT` | `127.0.0.1`, `3306` | |
| `DB_DATABASE` | `samplecap` | |
| `DB_USERNAME`, `DB_PASSWORD` | — | Use a dedicated least-privilege user in production |
| `DB_SOCKET` | `/Applications/MAMP/tmp/mysql/mysql.sock` | MAMP only |

### Redis, queues, cache

| Variable | Example | Purpose |
|---|---|---|
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `127.0.0.1`, `6379` | |
| `REDIS_CLIENT` | `phpredis` | or `predis` |
| `QUEUE_CONNECTION` | `redis` | `database` is fine locally |
| `CACHE_STORE` | `redis` | Rate limits, usage summaries, upload locks |
| `SESSION_DRIVER` | `array` | The API is stateless (tokens); sessions only matter for the Horizon page |
| `RENDER_QUEUE` | `renders` | Queue for MP4 renders |
| `RENDER_TIMEOUT` | `3600` | Max seconds per render |
| `HORIZON_BASIC_AUTH_USER`, `HORIZON_BASIC_AUTH_PASSWORD` | — | Required to open `/horizon` outside `local` |
| `HORIZON_PIPELINE_PROCESSES`, `HORIZON_RENDER_PROCESSES` | `4`, `2` | Worker counts in production |

### Storage

| Variable | Default | Purpose |
|---|---|---|
| `FILESYSTEM_DISK` | `local` | Laravel default disk (private) |
| `MEDIA_DISK` | `local` | Source videos, audio, thumbnails. `s3` for object storage |
| `EXPORT_DISK` | `local` | Exported files. `s3` for object storage |
| `MEDIA_STREAM_TTL` | `720` | Minutes a signed video/thumbnail URL stays valid |
| `EXPORT_DOWNLOAD_TTL` | `30` | Minutes a signed download URL stays valid |
| `UPLOAD_CHUNK_SIZE` | `5242880` | Bytes per upload chunk (keep < PHP `post_max_size`) |
| `UPLOAD_SESSION_TTL_HOURS` | `24` | Resume window for an unfinished upload |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET` | — | S3 credentials (bucket must be **private**) |
| `AWS_ENDPOINT`, `AWS_USE_PATH_STYLE_ENDPOINT` | — | For R2 / MinIO / Spaces |

### AI

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | `gemini` or `fake` (sample captions; never use in production) |
| `GEMINI_API_KEY` | — | Google AI Studio / Vertex key. Server-side only |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Model id |
| `GEMINI_BASE_URL`, `GEMINI_UPLOAD_URL` | Google endpoints | Override for proxies |
| `GEMINI_TIMEOUT` | `300` | Seconds per request |
| `GEMINI_INLINE_MAX_BYTES` | `15728640` | Larger audio goes through the Files API |
| `GEMINI_MAX_OUTPUT_TOKENS` | `65536` | Upper bound for one transcription |

### FFmpeg & fonts

| Variable | Default | Purpose |
|---|---|---|
| `FFMPEG_BINARY` | `ffmpeg` | Must include libass ≥ 0.17 |
| `FFPROBE_BINARY` | `ffprobe` | |
| `CAPTION_FONTS_PATH` | `storage/app/fonts` | Fonts burned into MP4s |

### Plans & limits

| Variable | Default | Purpose |
|---|---|---|
| `DEFAULT_PLAN` | `free` | Plan for new users |
| `FREE_CAPTION_MINUTES` | `120` | Caption minutes per month (free) |
| `FREE_AI_REQUESTS_PER_DAY` | `30` | AI requests per day (free) |
| `FREE_STORAGE_MB` | `5120` | Storage (free) |
| `MAX_UPLOAD_MB` | `500` | Max upload size (free) |

Other plans are edited in `config/plans.php`.

### Auth & logging

| Variable | Default | Purpose |
|---|---|---|
| `SANCTUM_TOKEN_EXPIRATION` | `43200` | Token lifetime in minutes; `0` = never |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `LOG_CHANNEL` / `LOG_STACK` | `stack` / `daily` | Application log |
| `LOG_LEVEL` | `debug` (local), `info` or `warning` (production) | |
| `LOG_STRUCTURED_CHANNEL` | `structured` | JSON event log (`storage/logs/events-*.log`); set `stderr`-style channel for containers |
| `LOG_DAILY_DAYS` | `14` | Retention |

## Frontend (`frontend/.env`)

Vite inlines these at **build time** — rebuild after changing them. Never put secrets here.

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://api.example.com/api` | API base URL |
| `VITE_BRAND_NAME` | `SampleCap` | Product name everywhere in the UI and `<title>` |
| `VITE_BRAND_SHORT_NAME`, `VITE_BRAND_TAGLINE`, `VITE_BRAND_DESCRIPTION`, `VITE_BRAND_SUPPORT_EMAIL` | — | Brand copy |
| `VITE_SHOW_DEMO_LOGIN` | `true` | Show the demo account helper (development builds only) |
