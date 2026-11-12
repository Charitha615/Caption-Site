<?php

namespace App\Jobs;

use App\Models\Export;
use App\Models\UsageRecord;
use App\Services\Export\ExportService;
use App\Services\Rendering\AssCaptionRenderer;
use App\Services\Rendering\FontRegistry;
use App\Services\Rendering\RenderException;
use App\Services\Rendering\RenderOptions;
use App\Services\Rendering\VideoRendererService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Renders a captioned MP4 for an Export:
 *   project → captions → style snapshot → ASS script → FFmpeg (libass) → storage → export record.
 *
 * Progress is written to the export row (throttled). Deleting the export while it
 * renders cancels FFmpeg. Users only ever see safe messages; FFmpeg stderr goes to logs.
 */
class RenderVideoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout;
    public bool $failOnTimeout = true;
    public bool $deleteWhenMissingModels = true;

    public function __construct(public Export $export)
    {
        $this->timeout = (int) config('captions.render_timeout', 3600) + 60;
    }

    public function handle(
        VideoRendererService $renderer,
        AssCaptionRenderer $captionRenderer,
        ExportService $exports,
        FontRegistry $fonts,
    ): void {
        $export = $this->export->fresh();
        if (!$export || $export->status !== Export::STATUS_QUEUED) {
            return; // deleted, or already handled by another attempt
        }

        $export->update(['status' => Export::STATUS_PROCESSING, 'started_at' => now(), 'progress' => 0, 'error_message' => null]);
        $workDir = storage_path('app/private/tmp/render-' . $export->uuid);

        try {
            $project = $export->project;
            $media = $project->primaryMediaFile;
            if (!$media) {
                throw new RenderException('This project has no video to render.');
            }
            $inputPath = Storage::disk($media->disk)->path($media->file_path);

            $meta = $export->metadata ?? [];
            $width = (int) $meta['width'];
            $height = (int) $meta['height'];
            $quality = config('captions.qualities.' . ($meta['quality'] ?? 'standard')) ?? config('captions.qualities.standard');

            File::ensureDirectoryExists($workDir, 0700);
            $assPath = $workDir . '/captions.ass';
            $outPath = $workDir . '/output.mp4';
            file_put_contents($assPath, $captionRenderer->render($exports->captionsFor($project), $meta['style'] ?? [], $width, $height));

            $lastWrite = 0.0;
            $lastCancelCheck = 0.0;
            $renderer->render(
                new RenderOptions(
                    inputPath: $inputPath,
                    subtitlePath: $assPath,
                    outputPath: $outPath,
                    fontsDir: $fonts->fontsPath(),
                    width: $width,
                    height: $height,
                    crf: (int) $quality['crf'],
                    preset: (string) $quality['preset'],
                    audioBitrate: (string) $quality['audio_bitrate'],
                    durationSeconds: (float) ($meta['duration'] ?? 0),
                ),
                onProgress: function (int $percent) use ($export, &$lastWrite) {
                    $now = microtime(true);
                    if ($percent < 100 && $now - $lastWrite < 1.0) {
                        return;
                    }
                    $lastWrite = $now;
                    Export::whereKey($export->id)->update(['progress' => min(99, $percent)]);
                },
                shouldCancel: function () use ($export, &$lastCancelCheck) {
                    $now = microtime(true);
                    if ($now - $lastCancelCheck < 2.0) {
                        return false;
                    }
                    $lastCancelCheck = $now;

                    return !Export::whereKey($export->id)->exists(); // soft-deleted → cancelled
                },
            );

            $target = $exports->storagePath($export);
            $stream = fopen($outPath, 'rb');
            Storage::disk($exports->disk())->writeStream($target, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }

            $export->update([
                'status' => Export::STATUS_COMPLETED,
                'progress' => 100,
                'file_path' => $target,
                'file_size' => filesize($outPath) ?: null,
                'completed_at' => now(),
            ]);

            UsageRecord::create([
                'user_id' => $project->user_id,
                'project_id' => $project->id,
                'action' => 'video_render',
                'quantity' => (float) ($meta['duration'] ?? 0),
                'unit' => 'seconds',
            ]);
        } catch (RenderException $e) {
            if ($e->cancelled) {
                Log::info("Render cancelled for export {$export->uuid}");

                return;
            }
            Log::error("Render failed for export {$export->uuid}: {$e->getMessage()}", ['ffmpeg' => $e->details]);
            $this->markFailed($export, $e->getMessage());
        } catch (\Throwable $e) {
            Log::error("Render crashed for export {$export->uuid}", ['exception' => $e]);
            $this->markFailed($export, 'Rendering failed unexpectedly. Please try again.');
        } finally {
            File::deleteDirectory($workDir);
        }
    }

    /** Timeouts and worker crashes land here. */
    public function failed(?\Throwable $exception): void
    {
        $export = $this->export->fresh();
        if ($export && !$export->isFinished()) {
            $this->markFailed($export, 'Rendering took too long or the worker stopped. Please try again.');
        }
    }

    protected function markFailed(Export $export, string $message): void
    {
        $export->update(['status' => Export::STATUS_FAILED, 'error_message' => $message, 'completed_at' => now()]);
    }
}
