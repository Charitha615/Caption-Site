<?php

namespace App\Console\Commands;

use App\Models\Caption;
use App\Services\Caption\SinhalaScriptRepair;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('captions:repair-sinhala {project? : Project UUID (default: all projects)} {--dry-run : Only show what would change}')]
#[Description('Fix Sinhala captions where the speech model wrote syllables in another Indic script')]
class RepairSinhalaCaptions extends Command
{
    public function handle(SinhalaScriptRepair $repair): int
    {
        $query = Caption::query()->orderBy('project_id')->orderBy('sequence');
        if ($uuid = $this->argument('project')) {
            $query->whereHas('project', fn ($q) => $q->where('uuid', $uuid));
        }

        $changed = 0;
        $query->chunkById(500, function ($captions) use ($repair, &$changed) {
            foreach ($captions as $caption) {
                if (! $repair->needsRepair((string) $caption->text)) {
                    continue;
                }
                [[$seg]] = $repair->repairSegments([['text' => $caption->text, 'words' => $caption->metadata['words'] ?? []]]);
                $this->line("#{$caption->sequence}: {$caption->text}  →  {$seg['text']}");
                $changed++;
                if (! $this->option('dry-run')) {
                    $meta = $caption->metadata ?? [];
                    $meta['original_text'] ??= $caption->text;
                    $meta['script_repaired'] = true;
                    $meta['words'] = $seg['words'];
                    $caption->update(['text' => $seg['text'], 'metadata' => $meta]);
                }
            }
        });

        $this->info(($this->option('dry-run') ? 'Would repair ' : 'Repaired ')."{$changed} caption(s).");

        return self::SUCCESS;
    }
}
