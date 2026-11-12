<?php

namespace App\Console\Commands;

use App\Models\CaptionTemplate;
use Illuminate\Console\Command;

class SyncCaptionTemplates extends Command
{
    protected $signature = 'captions:sync-templates';

    protected $description = 'Create/update system caption templates from resources/captions/presets.json';

    public function handle(): int
    {
        $this->info('Synced ' . CaptionTemplate::syncSystemTemplates() . ' system templates.');

        return self::SUCCESS;
    }
}
