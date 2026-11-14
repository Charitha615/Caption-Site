# Local setup

Get the API, queue worker and web app running on your machine. Production is covered in [DEPLOYMENT.md](DEPLOYMENT.md); every variable is listed in [ENVIRONMENT.md](ENVIRONMENT.md).

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| PHP | 8.3+ | Extensions: `pdo_mysql` or `pdo_pgsql`, `mbstring`, `intl`, `fileinfo`, `curl`, `zip`; `pcntl` + `posix` + `redis` for Horizon |
| Composer | 2.x | |
| Node.js | 20+ | npm 10+ |
| Database | MySQL 8 / MariaDB 10.6+ / PostgreSQL 14+ | `utf8mb4` for Sinhala |
| FFmpeg | 6+ **with libass ≥ 0.17** | Needed for processing uploads and MP4 export |
| Redis | 7+ | Optional locally (database queue works); required for Horizon |

macOS:

```bash
brew install php composer node mysql redis ffmpeg-full
```

Debian/Ubuntu:

```bash
sudo apt install php8.3-{cli,mysql,mbstring,intl,curl,zip,xml,redis} composer nodejs npm mysql-server redis-server ffmpeg
```

MAMP users: `./dev.sh` picks up MAMP's PHP automatically. Use `DB_PORT=8889` and `DB_SOCKET=/Applications/MAMP/tmp/mysql/mysql.sock`.

## 2. Database

```sql
CREATE DATABASE samplecap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

PostgreSQL: `CREATE DATABASE samplecap ENCODING 'UTF8';` and set `DB_CONNECTION=pgsql`, `DB_PORT=5432`.

## 3. Backend (Laravel)

```bash
cd backend
composer install
cp .env.example .env          # set DB_* and, optionally, GEMINI_API_KEY
php artisan key:generate
php artisan migrate --seed    # demo user: demo@samplecap.com / password123
php artisan captions:install-fonts   # caption fonts for MP4 rendering (one-time download)
```

- **Gemini:** put your key in `GEMINI_API_KEY`. Without a key, local environments use sample captions (clearly labelled) so you can work on the UI.
- **FFmpeg:** if it isn't on your PATH or lacks libass, point `FFMPEG_BINARY` / `FFPROBE_BINARY` at a full build (macOS: `/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`). Check with `ffmpeg -hide_banner -filters | grep " ass "`.
- `php artisan storage:link` is **not** needed: user media is private and served through signed URLs.

## 4. Frontend (React + Vite)

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api
```

## 5. Run everything

```bash
./dev.sh
```

Starts the API (`:8000`), a queue worker for the `default` and `renders` queues, and Vite (`:5173`). Ctrl+C stops all three. Open http://localhost:5173.

Manually, in three terminals:

```bash
cd backend && php artisan serve
cd backend && php artisan queue:work --queue=default,renders --tries=1 --timeout=3700
cd frontend && npm run dev
```

With Redis you can use Horizon instead of `queue:work`: set `QUEUE_CONNECTION=redis` and run `php artisan horizon` (dashboard at http://localhost:8000/horizon).

After changing PHP code, restart the worker (`php artisan queue:restart`) — workers keep old code in memory.

## 6. Tests and checks

```bash
cd backend
php artisan test              # PHPUnit (SQLite in memory; never calls the real AI)
vendor/bin/pint               # code style

cd frontend
npm test                      # Vitest + Testing Library
npm run typecheck
npm run lint
npm run build
```

## 7. Renaming the product

Two variables, no code changes:

```bash
# frontend/.env
VITE_BRAND_NAME=පේළිCap
# backend/.env
BRAND_NAME=පේළිCap
```

Restart Vite / rebuild the frontend, and run `php artisan config:clear` (or `config:cache` in production).

## 8. Useful commands

| Command | What it does |
|---|---|
| `php artisan migrate:fresh --seed` | Reset the database with demo data |
| `php artisan captions:sync-templates` | Update built-in caption templates from `presets.json` |
| `php artisan uploads:prune` | Delete abandoned upload chunks and temp files (runs hourly) |
| `php artisan media:make-private` | Move media uploaded before private storage off the public disk |
| `php artisan schedule:work` | Run the scheduler locally |
| `php artisan pail` | Tail logs |
| `tail -f storage/logs/events-$(date +%F).log \| jq` | Structured events (uploads, AI, FFmpeg, exports) |
