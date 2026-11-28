# Production deployment

A reference deployment on one Linux VM (Ubuntu 24.04), with notes for scaling out. Any equivalent (Laravel Forge/Cloud, Docker, Kubernetes) works if it provides the same pieces.

```
            HTTPS                         HTTPS
Browser ──────────► app.example.com     api.example.com ◄── signed media URLs
                    (static SPA, CDN)   Nginx → PHP-FPM (Laravel)
                                              │
                    MySQL/PostgreSQL ◄────────┼────────► Redis
                                              │
                    Horizon (supervisord): pipeline + renders ──► FFmpeg, Gemini
                                              │
                    Private storage: local disk or S3/R2 bucket
```

## 1. Server packages

```bash
sudo apt install nginx php8.3-{fpm,cli,mysql,pgsql,mbstring,intl,curl,zip,xml,redis,gd} \
  composer redis-server supervisor ffmpeg mysql-server   # or a managed DB/Redis
ffmpeg -hide_banner -filters | grep " ass "              # must list the libass filter
```

PHP (`/etc/php/8.3/fpm/php.ini` and `cli/php.ini`):

```ini
memory_limit = 512M
post_max_size = 16M          ; > UPLOAD_CHUNK_SIZE (5 MB default)
upload_max_filesize = 16M    ; only the legacy single-request upload uses this
max_execution_time = 120
expose_php = Off
```

## 2. Database and Redis

- Create the database with `utf8mb4` / `utf8mb4_unicode_ci` (MySQL) or `UTF8` (PostgreSQL), and a dedicated user with rights only on it.
- Redis: bind to localhost or a private network, set `requirepass`, enable persistence (AOF) so queued jobs survive restarts.
- Back up the database daily; test restores.

## 3. Laravel API

```bash
cd /var/www/samplecap/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env    # then edit — see the checklist below
php artisan key:generate
php artisan migrate --force
php artisan captions:install-fonts
php artisan captions:sync-templates
php artisan config:cache && php artisan route:cache && php artisan event:cache
sudo chown -R www-data:www-data storage bootstrap/cache
```

Production `.env` checklist:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
TRUSTED_PROXIES=*                 # only if behind a load balancer/CDN
QUEUE_CONNECTION=redis
CACHE_STORE=redis
RENDER_QUEUE=renders
HORIZON_BASIC_AUTH_USER=ops
HORIZON_BASIC_AUTH_PASSWORD=<long random>
AI_PROVIDER=gemini
AI_ALLOW_SERVER_KEY=false         # users bring their own Google AI key
GEMINI_API_KEY=                   # only needed if AI_ALLOW_SERVER_KEY=true
FFMPEG_BINARY=/usr/bin/ffmpeg
FFPROBE_BINARY=/usr/bin/ffprobe
LOG_LEVEL=info
BRAND_NAME=SampleCap
```

Nginx (API):

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    root /var/www/samplecap/backend/public;
    client_max_body_size 16m;          # chunk uploads; raise if you raise UPLOAD_CHUNK_SIZE
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / { try_files $uri /index.php?$query_string; }
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_read_timeout 300;      # assembling large uploads
    }
    location ~ /\.(?!well-known) { deny all; }
}
server { listen 80; server_name api.example.com; return 301 https://$host$request_uri; }
```

HTTPS: `sudo certbot --nginx -d api.example.com -d app.example.com`.

## 4. Queue workers (Horizon) and scheduler

`/etc/supervisor/conf.d/samplecap.conf`:

```ini
[program:samplecap-horizon]
command=php /var/www/samplecap/backend/artisan horizon
user=www-data
autostart=true
autorestart=true
stopwaitsecs=3700            ; let a running render finish on deploy
stdout_logfile=/var/www/samplecap/backend/storage/logs/horizon.log
```

```bash
sudo supervisorctl reread && sudo supervisorctl update
```

Horizon runs two supervisors (`config/horizon.php`): **pipeline** (`default` queue: probing, audio, Gemini; timeout 1000 s) and **renders** (`renders` queue: MP4; timeout `RENDER_TIMEOUT` + 120 s, lower CPU priority). Scale with `HORIZON_PIPELINE_PROCESSES` / `HORIZON_RENDER_PROCESSES`. Each render uses roughly one CPU core per process. Dashboard: `https://api.example.com/horizon` (HTTP Basic, credentials above).

Without Redis/Horizon, two plain workers do the same job:

```bash
php artisan queue:work --queue=default --tries=1 --timeout=960
php artisan queue:work --queue=renders --tries=1 --timeout=3700
```

Scheduler (cron, `www-data`):

```cron
* * * * * php /var/www/samplecap/backend/artisan schedule:run >> /dev/null 2>&1
```

It prunes abandoned uploads hourly, expired tokens and old failed jobs daily, and takes Horizon metric snapshots.

## 5. Storage

**Local disk (single server):** media lives in `backend/storage/app/private` (never web-served). Put it on a volume with room for uploads and renders, and back it up.

**Object storage (recommended for more than one server):**

```bash
composer require league/flysystem-aws-s3-v3 "^3.0"
```

```dotenv
MEDIA_DISK=s3
EXPORT_DISK=s3
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_DEFAULT_REGION=auto            # R2: auto
AWS_BUCKET=samplecap-media         # PRIVATE bucket, no public ACLs
AWS_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # R2/MinIO/Spaces only
```

Streams and downloads then redirect to short-lived pre-signed bucket URLs; workers copy files to local scratch space for FFmpeg and clean up after themselves. Upload chunks are always written to local disk first (`storage/app/chunks`), so that disk needs room for in-flight uploads.

If you upgraded from a version that stored uploads on the `public` disk, run once: `php artisan media:make-private`, then remove the `public/storage` symlink.

## 6. Frontend

```bash
cd frontend
npm ci
VITE_API_URL=https://api.example.com/api VITE_BRAND_NAME=SampleCap npm run build
```

Set `VITE_SITE_URL=https://sinsub.cc` (the one public address: canonical URLs, sitemap and share tags use it).

`npm run build` also **prerenders the public pages** (home, `/si`, feature pages, guides) into real HTML files, and writes `sitemap.xml`, `robots.txt` and `app.html` (the empty app shell). Upload `frontend/dist/` to any static host or CDN:

- A path that has a prerendered page serves it: `/guides` → `guides/index.html` (no trailing slash; `/guides/` should 301 to `/guides`).
- **Every other path serves `app.html`** (SPA fallback), not `index.html`, which is now the home page.
- Cache `assets/*` for one year (file names are content-hashed); never cache `*.html`.

Apache / Hostinger: `public/.htaccess` (copied into `dist/`) does all of this, plus the domain redirect below. Netlify / Cloudflare Pages: `public/_redirects` sets the fallback.

**Icons and share image.** The tab icon (white සිං on orange), phone home-screen icons and the 1200×630 share image are made from the templates in `frontend/scripts/brand/`: change the HTML, then run `node scripts/brand/icons.mjs` or `node scripts/brand/og-image.mjs` (needs Google Chrome).

**One domain.** Today the main domain is `https://sinsub.cc`; `www.sinsub.cc` 301s to it (in `.htaccess`; on Nginx use a separate `server` block with `return 301 https://sinsub.cc$request_uri;`).

**After the first deploy:** add `https://sinsub.cc` in Google Search Console and Bing Webmaster Tools, submit `https://sinsub.cc/sitemap.xml`, and use URL inspection on the home page to check Google sees the content. Check link previews with the Facebook Sharing Debugger.

### Moving the main domain to sinsub.lk (later)

Once `sinsub.lk` is bought, keep `sinsub.cc` too; both work, and `.cc` sends visitors to `.lk`:

1. Point `sinsub.lk` and `www.sinsub.lk` at the same site (hPanel → Domains) and turn on SSL for both. Keep `sinsub.cc` and `www.sinsub.cc` attached.
2. `frontend/.env.production`: `VITE_BRAND_DOMAIN=sinsub.lk`, `VITE_SITE_URL=https://sinsub.lk`, `VITE_BRAND_SUPPORT_EMAIL=support@sinsub.lk`.
3. `frontend/public/.htaccess`: swap the "NOW" redirect for the "LATER" one (all hosts → `https://sinsub.lk`, path kept, 301).
4. Backend `.env`: `FRONTEND_URL=https://sinsub.lk`, `BRAND_DOMAIN=sinsub.lk`, `BRAND_SUPPORT_EMAIL=support@sinsub.lk`; then `php artisan config:cache`.
5. Google OAuth client (if used): add `https://sinsub.lk` to Authorized JavaScript origins.
6. Share image: `node scripts/brand/og-image.mjs sinsub.lk` (from `frontend/`; it prints the domain on the image). Then `npm run build` and upload `dist/`. Check `curl -I https://sinsub.cc/guides` returns `301` to `https://sinsub.lk/guides`.
7. Search Console: add `https://sinsub.lk`, submit its sitemap, then use **Change of Address** on the `sinsub.cc` property so rankings move over. Keep `sinsub.cc` renewed for at least a year or two.

Nginx (app):

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    root /var/www/samplecap/frontend/dist;
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location / { try_files $uri $uri/index.html /app.html; add_header Cache-Control "no-cache"; }
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.example.com; img-src 'self' data: blob: https://api.example.com https://images.unsplash.com https://*.r2.cloudflarestorage.com; media-src 'self' blob: https://api.example.com https://*.r2.cloudflarestorage.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'";
}
```

Adjust the CSP hosts to your API and bucket domains.

## 6b. Pro plan and bank-transfer payments

Free and Pro are defined in `backend/config/plans.php` (limits and features) and `backend/config/billing.php` (prices, bank details). The pricing cards in `frontend/src/config/pricing.ts` mirror them: change both together.

1. In the backend `.env`, fill in the account people pay into (shown on `/billing` exactly as written):
   `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_BRANCH`. Prices: `PRO_PRICE_MONTHLY=490`, `PRO_PRICE_YEARLY=3990`. WhatsApp for slips: `BILLING_WHATSAPP="075 517 3298"`.
   Until the account number and name are set, the payment page asks people to WhatsApp you instead.
2. `php artisan migrate --force` (adds `payments`, and `plan_expires_at` on users) and `php artisan config:cache`.
3. Make yourself an admin if you aren't: `php artisan users:make-admin you@example.com`. Admins get an email for every new payment (mail must be configured) and see **Payments** in the sidebar.
4. The scheduler (section 4) must be running: it emails "Pro ends soon" reminders daily at 09:00 (`billing:pro-reminders`).

**How a payment works:** the user opens **Upgrade to Pro** (`/billing`), picks monthly or yearly, transfers the amount with their reference (e.g. `SS-7KQ2PX`, the same every time) in the remarks, then uploads the slip or sends it on WhatsApp. On **Admin → Payments** you find the transfer in the bank by reference and amount, then **Approve** (Pro is on until the end of the paid month/year; paying early adds the time after the current end date) or **Reject** with a reason (emailed to them). When the end date passes the account is Free again; projects are kept.



```bash
cd /var/www/samplecap && git pull
cd backend && composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan event:cache
php artisan captions:sync-templates
php artisan horizon:terminate          # supervisor restarts it with the new code
cd ../frontend && npm ci && npm run build   # then publish dist/
```

`horizon:terminate` waits for running jobs to finish. Run migrations before restarting workers.

## 8. Monitoring

- `GET /up` — health check for the load balancer.
- `storage/logs/events-*.log` — JSON events (`pipeline.failed`, `ai.request_failed`, `render.failed`, `auth.login_failed`, `queue.job_failed`, …). Ship them to your log platform; alert on spikes of `*.failed`. Each line has `request_id`, which users see in error toasts as "Ref".
- Horizon — queue wait times, failed jobs, throughput.
- Gemini quotas/billing — usage per user is in `usage_records` (`action = ai_request`, tokens in `metadata`).

## 9. Security checklist

- [ ] `APP_DEBUG=false`, `APP_ENV=production`, strong unique `APP_KEY` — back it up: users' saved Google AI keys are encrypted with it
- [ ] HTTPS everywhere; `APP_URL` uses `https://`
- [ ] `CORS_ALLOWED_ORIGINS` lists only your web app
- [ ] DB/Redis reachable only from the app servers; strong passwords
- [ ] Storage bucket is private; no `public/storage` symlink
- [ ] Horizon basic-auth credentials set
- [ ] `.env` readable only by the app user (`chmod 640`)
- [ ] OS/PHP/FFmpeg patched; `composer audit` and `npm audit` in CI
