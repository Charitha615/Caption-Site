<?php

namespace App\Services\Video;

use App\Exceptions\VideoProcessingException;
use App\Services\Rendering\ProcessRunner;
use App\Services\Video\Contracts\VideoServiceInterface;
use App\Support\AppLog;
use Symfony\Component\Process\Exception\ProcessTimedOutException;

class FFmpegService implements VideoServiceInterface
{
    protected string $ffmpegBinary;

    protected string $ffprobeBinary;

    public function __construct(protected ProcessRunner $runner)
    {
        // Config (not env()) so `php artisan config:cache` works in production.
        $this->ffmpegBinary = (string) config('captions.ffmpeg_binary', 'ffmpeg');
        $this->ffprobeBinary = (string) config('captions.ffprobe_binary', 'ffprobe');
    }

    public function getMetadata(string $filePath): array
    {
        $result = $this->run([
            $this->ffprobeBinary,
            '-v', 'error',
            '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,duration,sample_rate,channels:stream_tags=rotate:stream_side_data=rotation:format=duration',
            '-of', 'json',
            $filePath,
        ], 60, 'ffprobe');

        $data = json_decode($result['stdout'], true);
        $streams = is_array($data) ? ($data['streams'] ?? []) : [];
        $video = collect($streams)->firstWhere('codec_type', 'video');
        $audio = collect($streams)->firstWhere('codec_type', 'audio');

        if ($result['exitCode'] !== 0 || ! $video) {
            AppLog::error('ffmpeg.probe_failed', ['exit' => $result['exitCode'], 'stderr' => $result['stderr']]);
            throw new VideoProcessingException('This file could not be read as a video. Please upload a valid MP4, MOV, WEBM or MKV file.');
        }

        $duration = (float) ($data['format']['duration'] ?? $video['duration'] ?? $audio['duration'] ?? 0);
        if ($duration <= 0) {
            throw new VideoProcessingException('We could not determine the length of this video.');
        }

        $width = (int) ($video['width'] ?? 0);
        $height = (int) ($video['height'] ?? 0);
        // Phone videos are often stored landscape with a rotation flag.
        $rotation = abs((int) ($video['tags']['rotate'] ?? collect($video['side_data_list'] ?? [])->pluck('rotation')->first() ?? 0));
        if ($rotation === 90 || $rotation === 270) {
            [$width, $height] = [$height, $width];
        }

        return [
            'duration' => round($duration, 3),
            'width' => $width ?: 1920,
            'height' => $height ?: 1080,
            'fps' => $this->parseRate($video['avg_frame_rate'] ?? null) ?? $this->parseRate($video['r_frame_rate'] ?? null) ?? 30.0,
            'codec' => $video['codec_name'] ?? null,
            'audio_codec' => $audio['codec_name'] ?? null,
            'sample_rate' => isset($audio['sample_rate']) ? (int) $audio['sample_rate'] : null,
            'channels' => isset($audio['channels']) ? (int) $audio['channels'] : null,
            'has_audio' => $audio !== null,
        ];
    }

    public function extractAudio(string $videoPath, string $outputPath): string
    {
        if (! is_dir(dirname($outputPath))) {
            mkdir(dirname($outputPath), 0700, true);
        }

        $result = $this->run([
            $this->ffmpegBinary, '-hide_banner', '-nostdin', '-y',
            '-i', $videoPath,
            '-vn', '-map', '0:a:0',
            '-acodec', 'libmp3lame', '-ar', '16000', '-ac', '1', '-b:a', '64k',
            $outputPath,
        ], 900, 'ffmpeg');

        if ($result['exitCode'] !== 0 || ! is_file($outputPath) || filesize($outputPath) === 0) {
            AppLog::error('ffmpeg.extract_audio_failed', ['exit' => $result['exitCode'], 'stderr' => $result['stderr']]);
            throw new VideoProcessingException('We could not extract the audio from this video.');
        }

        return $outputPath;
    }

    public function generateThumbnail(string $videoPath, string $outputPath, float $timestamp = 1.0): bool
    {
        if (! is_dir(dirname($outputPath))) {
            mkdir(dirname($outputPath), 0700, true);
        }

        foreach ([max(0.0, $timestamp), 0.0] as $at) {
            $result = $this->runner->run([
                $this->ffmpegBinary, '-hide_banner', '-nostdin', '-y',
                '-ss', (string) $at, '-i', $videoPath,
                '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3',
                $outputPath,
            ], timeout: 60);
            if ($result['exitCode'] === 0 && is_file($outputPath) && filesize($outputPath) > 0) {
                return true;
            }
        }
        AppLog::warning('ffmpeg.thumbnail_failed', ['stderr' => $result['stderr'] ?? '']);

        return false;
    }

    /** @return array{exitCode: int, stdout: string, stderr: string, stopped: bool} */
    protected function run(array $command, int $timeout, string $tool): array
    {
        try {
            $result = $this->runner->run($command, timeout: $timeout);
        } catch (ProcessTimedOutException $e) {
            AppLog::error('ffmpeg.timeout', ['tool' => $tool, 'timeout' => $timeout]);
            throw new VideoProcessingException('Processing this video took too long. Try a shorter or smaller file.', [], $e);
        } catch (\Throwable $e) {
            AppLog::error('ffmpeg.unavailable', ['tool' => $tool, 'binary' => $command[0]], $e);
            throw new VideoProcessingException('Video processing is temporarily unavailable. Please try again later.', [], $e);
        }

        // 126/127 = the binary is missing or not executable — a server problem, not a bad file.
        if (in_array($result['exitCode'], [126, 127], true)) {
            AppLog::error('ffmpeg.unavailable', ['tool' => $tool, 'binary' => $command[0], 'exit' => $result['exitCode'], 'stderr' => $result['stderr']]);
            throw new VideoProcessingException('Video processing is unavailable: FFmpeg is not installed or not configured on the server. Your video is fine — retry once FFmpeg is set up.');
        }

        return $result;
    }

    private function parseRate(?string $rate): ?float
    {
        if (! $rate || ! str_contains($rate, '/')) {
            return null;
        }
        [$n, $d] = array_map('floatval', explode('/', $rate, 2));

        return $d > 0 && $n > 0 ? round($n / $d, 3) : null;
    }
}
