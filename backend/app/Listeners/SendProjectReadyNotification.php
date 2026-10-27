<?php

namespace App\Listeners;

use App\Events\CaptionsGeneratedEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SendProjectReadyNotification implements ShouldQueue
{
    use InteractsWithQueue;

    public function handle(CaptionsGeneratedEvent $event): void
    {
        Log::info("Captions generated for project [{$event->project->name}]. Total: {$event->captionCount}");
    }
}
