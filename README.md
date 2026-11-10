# SampleCap

## Run the backend (Laravel API — http://localhost:8000)

```bash
cd backend
composer install
cp .env.example .env        # then set your DB details
php artisan key:generate
php artisan migrate --seed
php artisan storage:link    # serves uploaded videos
php artisan serve
```

In a second terminal, start the queue worker (processes uploaded videos and caption generation):

```bash
cd backend
php artisan queue:work
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
| `php artisan queue:work` | backend | Run background jobs |
| `php artisan migrate` | backend | Apply database migrations |
| `php artisan migrate:fresh --seed` | backend | Reset the database with demo data |
| `php artisan test` | backend | Run the backend tests |
| `npm run dev` | frontend | Start the dev server |
| `npm run build` | frontend | Typecheck and build for production |
| `npm run preview` | frontend | Preview the production build |
| `npm run lint` | frontend | Lint the code |
