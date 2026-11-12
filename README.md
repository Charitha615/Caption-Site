# SampleCap

## Run the backend (Laravel API — http://localhost:8000)

```bash
cd backend
composer install
cp .env.example .env        # then set your DB details
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan captions:install-fonts   # fonts burned into MP4 exports
php artisan serve
```

In a second terminal, start the queue worker (processes uploaded videos, caption generation and MP4 renders):

```bash
cd backend
php artisan queue:work
```

MP4 export needs FFmpeg **with libass**. On macOS: `brew install ffmpeg-full`, then in `backend/.env`:

```bash
FFMPEG_BINARY=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
FFPROBE_BINARY=/opt/homebrew/opt/ffmpeg-full/bin/ffprobe
```

## Run the frontend (React app — http://localhost:5173)

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev
```

Demo login: `demo@samplecap.com` / `password123`

## Commands

| Command | Where | What it does |
| :--- | :--- | :--- |
| `php artisan serve` | backend | Start the API |
| `php artisan queue:work` | backend | Run background jobs (incl. MP4 renders) |
| `php artisan queue:restart` | backend | Reload workers after code changes |
| `php artisan captions:install-fonts` | backend | Download caption fonts for MP4 rendering |
| `php artisan captions:sync-templates` | backend | Update built-in caption templates |
| `php artisan migrate` | backend | Apply database migrations |
| `php artisan migrate:fresh --seed` | backend | Reset the database with demo data |
| `php artisan test` | backend | Run the backend tests |
| `npm run dev` | frontend | Start the dev server |
| `npm run build` | frontend | Typecheck and build for production |
| `npm run preview` | frontend | Preview the production build |
| `npm run lint` | frontend | Lint the code |
