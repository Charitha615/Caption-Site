<?php

use Illuminate\Support\Facades\Schedule;

/*
| Scheduled maintenance. Production runs `php artisan schedule:run` every minute
| (cron) or `php artisan schedule:work` (see docs/DEPLOYMENT.md).
*/
Schedule::command('uploads:prune')->hourly()->withoutOverlapping();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('queue:prune-failed --hours=720')->daily();
Schedule::command('queue:prune-batches --hours=48')->daily();
Schedule::command('horizon:snapshot')->everyFiveMinutes()->when(fn () => config('queue.default') === 'redis');
