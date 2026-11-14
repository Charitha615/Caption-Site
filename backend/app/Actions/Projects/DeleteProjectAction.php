<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Services\Media\MediaStorage;
use App\Support\AppLog;
use Illuminate\Support\Facades\File;

class DeleteProjectAction
{
    public function __construct(protected MediaStorage $storage) {}

    /**
     * Soft-delete the project and permanently remove its stored files
     * (source video, audio, thumbnail, exports, pending upload chunks).
     * Rows stay soft-deleted for auditing; the private files do not linger.
     */
    public function execute(Project $project): bool
    {
        foreach ($project->mediaFiles()->get() as $media) {
            $this->storage->delete($media->disk, $media->file_path);
            $this->storage->delete($media->disk, $media->audio_path);
            $media->update(['file_size' => 0]);
            $media->delete();
        }
        if ($project->thumbnail && ! preg_match('#^(https?://|/storage/)#i', $project->thumbnail)) {
            $this->storage->delete($this->storage->diskName(), $project->thumbnail);
        }

        $exportDisk = (string) config('captions.export_disk', 'local');
        foreach ($project->exports()->get() as $export) {
            $this->storage->delete($exportDisk, $export->file_path);
            $export->update(['file_size' => 0]);
            $export->delete();
        }

        foreach ($project->uploadSessions()->get() as $upload) {
            File::deleteDirectory($upload->chunkDirectory());
        }
        $project->uploadSessions()->delete();

        AppLog::info('project.deleted', ['project' => $project->uuid]);

        return (bool) $project->delete();
    }
}
