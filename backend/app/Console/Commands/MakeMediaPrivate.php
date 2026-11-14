<?php

namespace App\Console\Commands;

use App\Models\MediaFile;
use App\Models\Project;
use App\Services\Media\MediaStorage;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('media:make-private {--dry-run : Only report what would move}')]
#[Description('Move source videos and thumbnails uploaded before private storage from the public disk to the private media disk')]
class MakeMediaPrivate extends Command
{
    public function handle(MediaStorage $storage): int
    {
        $target = $storage->diskName();
        $dry = (bool) $this->option('dry-run');
        $public = Storage::disk('public');
        $moved = 0;

        MediaFile::withTrashed()->where('disk', 'public')->chunkById(100, function ($files) use ($public, $storage, $target, $dry, &$moved) {
            foreach ($files as $media) {
                if (! $public->exists($media->file_path)) {
                    continue;
                }
                $this->line(($dry ? '[dry-run] ' : '')."video {$media->uuid}");
                if (! $dry) {
                    $storage->putLocalFile($public->path($media->file_path), $media->file_path, $target);
                    $public->delete($media->file_path);
                    $media->forceFill(['disk' => $target])->saveQuietly();
                }
                $moved++;
            }
        });

        Project::withTrashed()->where('thumbnail', 'like', '/storage/thumbnails/%')->chunkById(100, function ($projects) use ($public, $storage, $target, $dry, &$moved) {
            foreach ($projects as $project) {
                $old = substr($project->thumbnail, strlen('/storage/'));
                $new = "thumbnails/{$project->uuid}.jpg";
                if (! $public->exists($old)) {
                    continue;
                }
                $this->line(($dry ? '[dry-run] ' : '')."thumbnail {$project->uuid}");
                if (! $dry) {
                    $storage->putLocalFile($public->path($old), $new, $target);
                    $public->delete($old);
                    $project->forceFill(['thumbnail' => $new])->saveQuietly();
                }
                $moved++;
            }
        });

        $this->info(($dry ? 'Would move ' : 'Moved ')."{$moved} files to the private '{$target}' disk.");

        return self::SUCCESS;
    }
}
