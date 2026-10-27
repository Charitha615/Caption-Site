<?php

namespace App\Jobs;

use App\Models\Export;
use App\Models\UsageRecord;
use App\Services\Caption\Contracts\SubtitleFormatterInterface;
use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RenderVideoWithCaptionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 900;

    public function __construct(
        public Export $export,
    ) {}

    public function handle(
        VideoServiceInterface $videoService,
        SubtitleFormatterInterface $formatter,
    ): void {
        $this->export->update(['status' => 'processing']);

        try {
            $project = $this->export->project;
            $mediaFile = $project->primaryMediaFile;

            if (!$mediaFile) {
                throw new \RuntimeException('No media file for video rendering.');
            }

            $disk = config('filesystems.default', 'local');
            $captions = $project->captions()->orderBy('sequence')->get();

            // Format SRT subtitles file
            $srtContent = $formatter->toSrt($captions);
            $srtTempPath = storage_path("app/temp/{$this->export->uuid}.srt");
            @mkdir(dirname($srtTempPath), 0755, true);
            file_put_contents($srtTempPath, $srtContent);

            $inputVideoPath = Storage::disk($mediaFile->disk)->path($mediaFile->file_path);
            $outputVideoPath = storage_path("app/public/renders/{$this->export->uuid}.mp4");
            @mkdir(dirname($outputVideoPath), 0755, true);

            // Burn subtitles using FFmpeg service
            $videoService->burnCaptions($inputVideoPath, $srtTempPath, $outputVideoPath);

            @unlink($srtTempPath);

            $fileSize = file_exists($outputVideoPath) ? filesize($outputVideoPath) : 0;
            $publicUrl = "/storage/renders/{$this->export->uuid}.mp4";

            $this->export->update([
                'status' => 'completed',
                'file_path' => "renders/{$this->export->uuid}.mp4",
                'file_size' => $fileSize,
                'download_url' => $publicUrl,
            ]);

            // Track usage
            $duration = (float) ($mediaFile->duration ?: 60.0);
            UsageRecord::create([
                'user_id' => $project->user_id,
                'project_id' => $project->id,
                'action' => 'video_render',
                'quantity' => $duration,
                'unit' => 'seconds',
            ]);
        } catch (\Throwable $e) {
            Log::error("Video rendering failed for export {$this->export->id}: " . $e->getMessage());
            $this->export->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
            throw $e;
        }
    }
}
