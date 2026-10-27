<?php

namespace App\Providers;

use App\Services\AI\Contracts\CaptionAIServiceInterface;
use App\Services\AI\GeminiCaptionService;
use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use App\Services\Caption\SubtitleFormatterService;
use App\Services\Video\Contracts\VideoServiceInterface;
use App\Services\Video\FFmpegService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(\App\Services\AI\AIProviderInterface::class, \App\Services\AI\GeminiAIProvider::class);
        $this->app->singleton(CaptionAIServiceInterface::class, GeminiCaptionService::class);
        $this->app->singleton(VideoServiceInterface::class, FFmpegService::class);
        $this->app->singleton(SubtitleFormatterInterface::class, SubtitleFormatterService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
