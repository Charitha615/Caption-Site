<?php

namespace App\Providers;

use App\Services\AI\AIProviderInterface;
use App\Services\AI\FakeAIProvider;
use App\Services\AI\GeminiAIProvider;
use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use App\Services\Caption\SubtitleFormatterService;
use App\Services\Video\Contracts\VideoServiceInterface;
use App\Services\Video\FFmpegService;
use App\Support\AppLog;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AIProviderInterface::class, function ($app) {
            $provider = config('ai.provider', 'gemini');
            $hasKey = ! empty(config('ai.gemini.api_key'));

            // Sample captions are only ever produced outside production.
            if ($provider === 'fake' || (! $hasKey && ! $app->environment('production'))) {
                return $app->make(FakeAIProvider::class);
            }

            return $app->make(GeminiAIProvider::class);
        });
        $this->app->singleton(VideoServiceInterface::class, FFmpegService::class);
        $this->app->singleton(SubtitleFormatterInterface::class, SubtitleFormatterService::class);
    }

    public function boot(): void
    {
        // Signed media/download URLs must be generated with the public HTTPS scheme behind a proxy.
        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        if ($proxies = config('app.trusted_proxies')) {
            TrustProxies::at($proxies === '*' ? '*' : array_map('trim', explode(',', $proxies)));
        }

        $this->configureRateLimiting();

        Queue::failing(function (JobFailed $event) {
            AppLog::error('queue.job_failed', [
                'job' => $event->job->resolveName(),
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'attempts' => $event->job->attempts(),
            ], $event->exception);
        });
    }

    protected function configureRateLimiting(): void
    {
        $byUser = fn (Request $request) => $request->user()?->id ?: $request->ip();

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(240)->by($byUser($request)));

        // Brute-force protection: per email+IP, plus a wider per-IP ceiling.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by('login-ip|'.$request->ip()),
        ]);
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(10)->by($request->ip()));

        RateLimiter::for('polling', fn (Request $request) => Limit::perMinute(120)->by($byUser($request)));
        RateLimiter::for('autosave', fn (Request $request) => Limit::perMinute(120)->by($byUser($request)));
        RateLimiter::for('uploads', fn (Request $request) => Limit::perHour(60)->by($byUser($request)));
        // 600 chunks/min ≈ 3 GB/min at 5 MB chunks — generous, but bounds abuse.
        RateLimiter::for('upload-chunks', fn (Request $request) => Limit::perMinute(600)->by($byUser($request)));
        RateLimiter::for('ai', fn (Request $request) => Limit::perHour(20)->by($byUser($request)));
        RateLimiter::for('exports', fn (Request $request) => Limit::perMinute(20)->by($byUser($request)));
        RateLimiter::for('media', fn (Request $request) => Limit::perMinute(600)->by($request->ip()));
    }
}
