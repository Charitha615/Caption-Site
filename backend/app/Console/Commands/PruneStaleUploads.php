<?php

namespace App\Console\Commands;

use App\Models\UploadSession;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

#[Signature('uploads:prune {--hours=2 : Also remove scratch files in storage/app/tmp older than this}')]
#[Description('Delete expired/cancelled upload sessions, their chunks and stale temporary files')]
class PruneStaleUploads extends Command
{
    public function handle(): int
    {
        $count = 0;
        UploadSession::query()
            ->where(fn ($q) => $q->where('expires_at', '<', now())->orWhere('status', '!=', UploadSession::STATUS_PENDING))
            ->where('updated_at', '<', now()->subHour())
            ->chunkById(200, function ($sessions) use (&$count) {
                foreach ($sessions as $session) {
                    File::deleteDirectory($session->chunkDirectory());
                    $session->delete();
                    $count++;
                }
            });

        $cutoff = now()->subHours((int) $this->option('hours'))->getTimestamp();
        $tmp = 0;
        foreach ([storage_path('app/tmp'), storage_path('app/private/tmp')] as $dir) {
            if (! is_dir($dir)) {
                continue;
            }
            foreach (File::files($dir) as $file) {
                if ($file->getMTime() < $cutoff) {
                    File::delete($file->getPathname());
                    $tmp++;
                }
            }
            foreach (File::directories($dir) as $sub) {
                if (filemtime($sub) < $cutoff) {
                    File::deleteDirectory($sub);
                    $tmp++;
                }
            }
        }

        $this->info("Pruned {$count} upload sessions and {$tmp} temporary files.");

        return self::SUCCESS;
    }
}
