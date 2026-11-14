# SampleCap

AI video captioning for Sinhala and English creators: upload a video, get timed captions from Gemini, edit and style them in a browser studio, and export SRT, VTT, TXT, JSON or an MP4 with the captions burned in.

> The product name is configuration: set `VITE_BRAND_NAME` (frontend) and `BRAND_NAME` (backend) to rename it, e.g. to **පේළිCap**.

| Part | Stack |
|---|---|
| `frontend/` | React 19, TypeScript, Vite, Zustand, plain CSS |
| `backend/` | Laravel 13, Sanctum, Horizon, MySQL/PostgreSQL, Redis |
| Processing | FFmpeg + libass, Google Gemini |

## Quick start

```bash
# one-time
cd backend && composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed && php artisan captions:install-fonts && cd ..
cd frontend && npm install && cp .env.example .env && cd ..

# every time
./dev.sh        # API :8000 · queue worker · web app :5173
```

Open http://localhost:5173. Demo login: `demo@samplecap.com` / `password123`.

You need PHP 8.3+, Composer, Node 20+, MySQL 8 (or PostgreSQL) and FFmpeg with libass. Each user adds their own Google AI key under **Account & usage** (get one at https://aistudio.google.com/app/api-keys); for UI work without a key set `AI_PROVIDER=fake`. Details: [docs/SETUP.md](docs/SETUP.md).

## Features

- **Uploads:** chunked and resumable (survives network drops), progress with speed/ETA, cancel, content-based file validation.
- **AI captions:** one Gemini request per video, word-level timings, Sinhala Unicode preserved (ZWJ conjuncts such as ශ්‍රී).
- **Studio editor:** timeline with drag-to-retime, split/merge, undo/redo, keyboard shortcuts, 7 style presets and saved templates, debounced autosave.
- **Exports:** SRT, VTT, TXT, JSON instantly; MP4 renders on a background queue at 720p/1080p/4K, matching the editor preview.
- **SaaS foundation:** per-user authorization, rate limits, private storage with signed URLs, usage ledger and plan limits, structured logs, Horizon.

## Commands

| Command | Where | What it does |
| :--- | :--- | :--- |
| `./dev.sh` | root | Run API, worker and web app together |
| `php artisan test` | backend | Backend tests (PHPUnit) |
| `vendor/bin/pint` | backend | Format PHP code |
| `php artisan horizon` | backend | Queue workers + dashboard (Redis) |
| `php artisan queue:work --queue=default,renders` | backend | Plain worker (no Redis needed) |
| `php artisan queue:restart` | backend | Reload workers after code changes |
| `php artisan captions:install-fonts` | backend | Download fonts for MP4 rendering |
| `php artisan captions:sync-templates` | backend | Update built-in caption templates |
| `php artisan uploads:prune` | backend | Remove abandoned uploads (scheduled hourly) |
| `php artisan media:make-private` | backend | Move pre-existing public media to private storage |
| `php artisan migrate:fresh --seed` | backend | Reset the database with demo data |
| `npm test` | frontend | Frontend tests (Vitest) |
| `npm run typecheck` / `npm run lint` | frontend | Type check / lint |
| `npm run build` | frontend | Production build |

## Documentation

| Document | Contents |
|---|---|
| [SETUP.md](docs/SETUP.md) | Local installation: Laravel, React, database, Redis, FFmpeg, Gemini |
| [ENVIRONMENT.md](docs/ENVIRONMENT.md) | Every environment variable |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, pipeline, editor, security, usage limits, extension points |
| [API.md](docs/API.md) | HTTP API reference |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production: Nginx, HTTPS, Horizon, object storage, frontend hosting |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and fixes |
