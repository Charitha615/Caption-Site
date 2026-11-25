<?php

use Illuminate\Support\Facades\Schedule;

/*
| Scheduled maintenance. Production runs `php artisan schedule:run` every minute
| (cron) or `php artisan schedule:work` (see docs/DEPLOYMENT.md).
*/
Schedule::command('uploads:prune')->hourly()->withoutOverlapping();
Schedule::command('projects:reset-stuck')->everyTenMinutes();
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('queue:prune-failed --hours=720')->daily();
Schedule::command('queue:prune-batches --hours=48')->daily();
Schedule::command('horizon:snapshot')->everyFiveMinutes()->when(fn () => config('queue.default') === 'redis');

// Shared hosting (e.g. Hostinger) has no supervisor: with QUEUE_RUN_IN_SCHEDULER=true the
// one-minute cron also starts a queue worker that drains captioning + render jobs and exits.
Schedule::command('queue:work', [
    '--queue='.implode(',', array_unique(['default', (string) config('captions.render_queue', 'default')])),
    '--stop-when-empty',
    '--tries=1',
    '--timeout='.((int) config('captions.render_timeout', 3600)),
    '--max-time=3300',
    '--memory=512',
])->everyMinute()->withoutOverlapping(60)->runInBackground()->when(fn () => (bool) config('queue.run_in_scheduler'));
