<?php

namespace App\Services\Video;

use App\Services\Video\Contracts\VideoServiceInterface;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class FFmpegService implements VideoServiceInterface
{
    protected string $ffmpegBinary;
    protected string $ffprobeBinary;

    public function __construct()
    {
        $this->ffmpegBinary = env('FFMPEG_BINARY', '/opt/homebrew/bin/ffmpeg');
        $this->ffprobeBinary = env('FFPROBE_BINARY', '/opt/homebrew/bin/ffprobe');

        // Fallbacks if not found at exact path
        if (!file_exists($this->ffmpegBinary)) {
            $this->ffmpegBinary = 'ffmpeg';
        }
        if (!file_exists($this->ffprobeBinary)) {
            $this->ffprobeBinary = 'ffprobe';
        }
    }

    /**
     * Inspect video metadata using FFprobe:
     * duration, width, height, fps, codec, audio codec, sample rate, channels.
     */
    public function getMetadata(string $filePath): array
    {
        $defaultMeta = [
            'duration' => 60.0,
            'width' => 1920,
            'height' => 1080,
            'fps' => 30.0,
            'codec' => 'h264',
            'audio_codec' => 'aac',
            'sample_rate' => 44100,
            'channels' => 2,
        ];

        if (!file_exists($filePath)) {
            return $defaultMeta;
        }

        try {
            $process = new Process([
                $this->ffprobeBinary,
                '-v', 'error',
                '-show_entries', 'stream=index,codec_type,codec_name,width,height,r_frame_rate,duration,sample_rate,channels:format=duration,size,bit_rate',
                '-of', 'json',
                $filePath,
            ]);

            $process->setTimeout(30);
            $process->run();

            if ($process->isSuccessful()) {
                $data = json_decode($process->getOutput(), true);
                $streams = $data['streams'] ?? [];
                $format = $data['format'] ?? [];

                $videoStream = null;
                $audioStream = null;

                foreach ($streams as $s) {
                    if (($s['codec_type'] ?? '') === 'video' && !$videoStream) {
                        $videoStream = $s;
                    } elseif (($s['codec_type'] ?? '') === 'audio' && !$audioStream) {
                        $audioStream = $s;
                    }
                }

                $duration = (float) ($videoStream['duration'] ?? $format['duration'] ?? $audioStream['duration'] ?? 60.0);
                $width = (int) ($videoStream['width'] ?? 1920);
                $height = (int) ($videoStream['height'] ?? 1080);

                $fps = 30.0;
                if (!empty($videoStream['r_frame_rate'])) {
                    $parts = explode('/', $videoStream['r_frame_rate']);
                    if (count($parts) === 2 && (float) $parts[1] > 0) {
                        $fps = round((float) $parts[0] / (float) $parts[1], 2);
                    }
                }

                return [
                    'duration' => round($duration, 2),
                    'width' => $width,
                    'height' => $height,
                    'fps' => $fps,
                    'codec' => $videoStream['codec_name'] ?? 'h264',
                    'audio_codec' => $audioStream['codec_name'] ?? 'aac',
                    'sample_rate' => (int) ($audioStream['sample_rate'] ?? 44100),
                    'channels' => (int) ($audioStream['channels'] ?? 2),
                ];
            } else {
                Log::warning('FFprobe command failed: ' . $process->getErrorOutput());
            }
        } catch (\Throwable $e) {
            Log::warning('FFprobe failed to inspect video, using defaults: ' . $e->getMessage());
        }

        return $defaultMeta;
    }

    /**
     * Extract audio stream from video for AI speech processing.
     * Extracts 16kHz mono MP3 optimized for speech recognition.
     */
    public function extractAudio(string $videoPath, string $outputPath): string
    {
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            $process = new Process([
                $this->ffmpegBinary,
                '-y',
                '-i', $videoPath,
                '-vn',
                '-acodec', 'libmp3lame',
                '-ar', '16000',
                '-ac', '1',
                '-b:a', '64k',
                $outputPath,
            ]);

            $process->setTimeout(300);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::error('FFmpeg extractAudio failed: ' . $process->getErrorOutput());
                // Fallback attempt: simple copy or standard MP3
                $fallbackProcess = new Process([
                    $this->ffmpegBinary,
                    '-y',
                    '-i', $videoPath,
                    '-vn',
                    $outputPath,
                ]);
                $fallbackProcess->setTimeout(180);
                $fallbackProcess->run();
            }
        } catch (\Throwable $e) {
            Log::error('FFmpeg extractAudio exception: ' . $e->getMessage());
        }

        return $outputPath;
    }

    /**
     * Generate thumbnail at specific timestamp.
     */
    public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): string
    {
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        try {
            $process = new Process([
                $this->ffmpegBinary,
                '-y',
                '-ss', (string) max(0.1, $timestamp),
                '-i', $videoPath,
                '-vframes', '1',
                '-q:v', '2',
                $outputPath,
            ]);

            $process->setTimeout(60);
            $process->run();

            if (!$process->isSuccessful()) {
                Log::warning('FFmpeg generateThumbnail failed: ' . $process->getErrorOutput());
                // Retry at 0.0s
                $retry = new Process([
                    $this->ffmpegBinary,
                    '-y',
                    '-i', $videoPath,
                    '-vframes', '1',
                    $outputPath,
                ]);
                $retry->run();
            }
        } catch (\Throwable $e) {
            Log::error('FFmpeg generateThumbnail exception: ' . $e->getMessage());
        }

        return $outputPath;
    }

    /**
     * Hardcode / burn captions (SRT or ASS) directly into MP4 video using FFmpeg.
     */
    public function burnCaptions(string $videoPath, string $subtitlesPath, string $outputPath, array $styleOptions = []): string
    {
        $dir = dirname($outputPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $escapedSubtitlesPath = str_replace([':', '\\'], ['\\:', '/'], $subtitlesPath);

        $process = new Process([
            $this->ffmpegBinary,
            '-y',
            '-i', $videoPath,
            '-vf', "subtitles={$escapedSubtitlesPath}",
            '-c:a', 'copy',
            $outputPath,
        ]);

        $process->setTimeout(600);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::error('FFmpeg burnCaptions failed: ' . $process->getErrorOutput());
        }

        return $outputPath;
    }
}
