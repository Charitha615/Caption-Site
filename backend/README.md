# SampleCap API

Laravel 13 API: auth, projects, chunked uploads, AI captioning pipeline, caption editing, exports and MP4 rendering. See the [root README](../README.md) and [docs/](../docs).

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan captions:install-fonts
php artisan serve                                  # http://localhost:8000
php artisan queue:work --queue=default,renders     # or: php artisan horizon
php artisan test
```

Code map: `app/Http/Controllers/Api` (thin controllers) · `app/Services` (AI, Media, Usage, Export, Rendering, Video) · `app/Jobs` (pipeline, renders) · `app/Policies` (ownership) · `config/{ai,plans,captions,brand}.php`. Details in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).
