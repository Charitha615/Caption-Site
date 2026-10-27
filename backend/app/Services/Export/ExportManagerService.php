<?php

namespace App\Services\Export;

use App\Models\Export;
use App\Models\Project;
use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ExportManagerService
{
    public function __construct(
        protected SubtitleFormatterInterface $formatter,
        protected VideoServiceInterface $videoService,
    ) {}

    /**
     * Generate an export for a project (srt, vtt, txt, json, mp4).
     */
    public function export(Project $project, string $format, int $userId): Export
    {
        $export = Export::create([
            'project_id' => $project->id,
            'user_id' => $userId,
            'format' => strtolower($format),
            'status' => 'pending',
        ]);

        try {
            $captions = $project->captions()->orderBy('sequence')->get();
            $disk = config('filesystems.default', 'local');
            $safeProjectName = Str::slug($project->name) ?: 'project';
            $fileName = "exports/{$safeProjectName}_{$export->uuid}.{$format}";

            switch (strtolower($format)) {
                case 'srt':
                    $content = $this->formatter->toSrt($captions);
                    Storage::disk($disk)->put($fileName, $content);
                    break;
                case 'vtt':
                    $content = $this->formatter->toVtt($captions);
                    Storage::disk($disk)->put($fileName, $content);
                    break;
                case 'txt':
                    $content = $this->formatter->toTxt($captions);
                    Storage::disk($disk)->put($fileName, $content);
                    break;
                case 'json':
                    $content = $this->formatter->toJson($captions);
                    Storage::disk($disk)->put($fileName, $content);
                    break;
                case 'mp4':
                    // Video render job would be queued in full implementation
                    $export->update([
                        'status' => 'processing',
                    ]);
                    return $export;
                default:
                    throw new \InvalidArgumentException("Unsupported export format: {$format}");
            }

            $fileSize = Storage::disk($disk)->size($fileName);
            $url = Storage::disk($disk)->url($fileName);

            $export->update([
                'status' => 'completed',
                'file_path' => $fileName,
                'file_size' => $fileSize,
                'download_url' => $url,
            ]);
        } catch (\Throwable $e) {
            $export->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
        }

        return $export;
    }
}
