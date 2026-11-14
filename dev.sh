#!/usr/bin/env bash
# Start the full local stack: Laravel API (:8000), queue worker, scheduler, and Vite frontend (:5173).
# Ctrl+C stops everything.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Fall back to MAMP's PHP when php isn't on PATH.
if ! command -v php >/dev/null 2>&1; then
  MAMP_PHP="$(ls -d /Applications/MAMP/bin/php/php8.[3-9]*/bin 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$MAMP_PHP" ] && export PATH="$MAMP_PHP:$PATH"
fi
command -v php >/dev/null || { echo "PHP >= 8.3 not found"; exit 1; }

[ -f "$ROOT/backend/.env" ]  || { echo "Missing backend/.env (cp backend/.env.example backend/.env)"; exit 1; }
[ -f "$ROOT/frontend/.env" ] || { echo "Missing frontend/.env (cp frontend/.env.example frontend/.env)"; exit 1; }
[ -d "$ROOT/backend/vendor" ] || { echo "Run: cd backend && composer install"; exit 1; }
[ -d "$ROOT/frontend/node_modules" ] || { echo "Run: cd frontend && npm install"; exit 1; }

trap 'kill 0' EXIT INT TERM

# Several PHP workers: the editor's video stream holds a connection open, and a single
# worker would make every other API call wait (and time out). --no-reload is required for
# workers, so restart dev.sh after editing backend/.env.
(cd "$ROOT/backend"  && PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-6}" php artisan serve --port=8000 --no-reload 2>&1 | sed 's/^/[api]   /') &
(cd "$ROOT/backend"  && php artisan queue:work --queue=default,renders --tries=1 --timeout=3700 2>&1 | sed 's/^/[queue] /') &
(cd "$ROOT/backend"  && php artisan schedule:work 2>&1 | sed 's/^/[cron]  /') &
(cd "$ROOT/frontend" && npm run dev 2>&1 | sed 's/^/[web]   /') &

wait
