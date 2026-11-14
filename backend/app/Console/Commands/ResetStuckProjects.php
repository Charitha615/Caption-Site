<?php

namespace App\Console\Commands;

use App\Jobs\ProcessUploadedVideoJob;
use App\Models\Project;
use App\Support\AppLog;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('projects:reset-stuck {--minutes= : Treat projects as stuck after this many minutes (default: job timeout + 5)}')]
#[Description('Mark projects whose processing was interrupted (worker stopped/crashed) as failed so users can retry')]
class ResetStuckProjects extends Command
{
    public function handle(): int
    {
        $minutes = (int) ($this->option('minutes') ?: ceil((new \ReflectionClass(ProcessUploadedVideoJob::class))->getDefaultProperties()['timeout'] / 60) + 5);

        // `uploaded` is excluded: those are waiting for a worker, not running.
        $stuck = Project::query()
            ->whereIn('status', array_diff(Project::PROCESSING_STATUSES, [Project::STATUS_UPLOADED]))
            ->where('updated_at', '<', now()->subMinutes($minutes))
            ->get();

        foreach ($stuck as $project) {
            $project->update([
                'status' => Project::STATUS_FAILED,
                'processing_error' => 'Processing was interrupted. Please retry.',
            ]);
            AppLog::warning('pipeline.reset_stuck', ['project' => $project->uuid, 'was' => $project->getOriginal('status'), 'minutes' => $minutes]);
        }

        $this->info("Reset {$stuck->count()} stuck project(s) (no progress for {$minutes}+ minutes).");

        return self::SUCCESS;
    }
}
