<?php

namespace App\Jobs;

use App\Services\Notifications\AdminWhatsApp;
use App\Support\AppLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/** Sends a WhatsApp alert to the admin in the background, retrying a few times if CallMeBot is busy. */
class SendAdminWhatsApp implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> seconds before each retry */
    public array $backoff = [30, 120];

    public function __construct(public string $text) {}

    public function handle(AdminWhatsApp $whatsApp): void
    {
        $whatsApp->send($this->text);
    }

    public function failed(Throwable $e): void
    {
        AppLog::warning('admin.whatsapp_failed', ['error' => $e->getMessage()]);
    }
}
