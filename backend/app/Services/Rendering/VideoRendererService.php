<?php

namespace App\Services\Rendering;

/**
 * Burns an ASS caption track into a video with FFmpeg + libass.
 *
 * Safety:
 *  - Commands are argv arrays run without a shell.
 *  - Input/output paths are prefixed with "file:" so a path can never be
 *    interpreted as an FFmpeg protocol or option.
 *  - Paths embedded inside the filtergraph are escaped with FilterEscaper.
 *  - Only whitelisted encoder values reach the command (validated in RenderOptions).
 */
class VideoRendererService
{
    protected ?array $capabilities = null;

    public function __construct(
        protected ProcessRunner $runner,
        protected ?string $ffmpeg = null,
    ) {
        $this->ffmpeg ??= (string) config('captions.ffmpeg_binary', 'ffmpeg');
    }

    /**
     * @return array{available: bool, libass: bool, error: ?string}
     */
    public function capabilities(): array
    {
        if ($this->capabilities !== null) {
            return $this->capabilities;
        }
        try {
            $result = $this->runner->run([$this->ffmpeg, '-hide_banner', '-filters'], timeout: 20);
        } catch (\Throwable $e) {
            return $this->capabilities = ['available' => false, 'libass' => false, 'error' => 'FFmpeg could not be started: ' . $e->getMessage()];
        }
        if ($result['exitCode'] !== 0) {
            return $this->capabilities = ['available' => false, 'libass' => false, 'error' => 'FFmpeg is not available at ' . $this->ffmpeg];
        }
        $libass = (bool) preg_match('/^\s*\S+\s+ass\s+V->V/m', $result['stdout']);

        return $this->capabilities = [
            'available' => true,
            'libass' => $libass,
            'error' => $libass ? null : 'This FFmpeg build has no libass, so captions cannot be burned in. Install a full FFmpeg build (macOS: brew install ffmpeg-full; Linux: apt install ffmpeg) and set FFMPEG_BINARY.',
        ];
    }

    /**
     * Output frame for a source size, canvas aspect and target short side.
     * Dimensions are always even (required by yuv420p).
     *
     * @return array{0: int, 1: int}
     */
    public static function outputSize(int $sourceWidth, int $sourceHeight, string $aspect, ?int $shortSide): array
    {
        $sourceWidth = max(2, $sourceWidth);
        $sourceHeight = max(2, $sourceHeight);
        $ratio = match ($aspect) {
            '16:9' => 16 / 9,
            '9:16' => 9 / 16,
            '1:1' => 1.0,
            '4:5' => 4 / 5,
            default => $sourceWidth / $sourceHeight,
        };
        $short = $shortSide ?? min($sourceWidth, $sourceHeight);
        if ($aspect === 'source' && $shortSide === null) {
            [$w, $h] = [$sourceWidth, $sourceHeight];
        } elseif ($ratio >= 1) {
            [$w, $h] = [$short * $ratio, $short];
        } else {
            [$w, $h] = [$short, $short / $ratio];
        }
        $even = fn (float $v) => max(16, (int) (round($v / 2) * 2));

        return [$even($w), $even($h)];
    }

    /** @return list<string> */
    public function buildCommand(RenderOptions $o): array
    {
        $filter = sprintf(
            'scale=%1$d:%2$d:force_original_aspect_ratio=decrease,pad=%1$d:%2$d:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,ass=filename=%3$s:fontsdir=%4$s:shaping=complex',
            $o->width,
            $o->height,
            FilterEscaper::optionValue($o->subtitlePath),
            FilterEscaper::optionValue($o->fontsDir),
        );

        return [
            $this->ffmpeg,
            '-hide_banner',
            '-nostdin',
            '-y',
            '-i', 'file:' . $o->inputPath,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-vf', $filter,
            '-c:v', 'libx264',
            '-preset', $o->preset,
            '-crf', (string) $o->crf,
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', $o->audioBitrate,
            '-movflags', '+faststart',
            '-progress', 'pipe:1',
            '-nostats',
            'file:' . $o->outputPath,
        ];
    }

    /**
     * @param callable(int $percent): void|null $onProgress
     * @param callable(): bool|null $shouldCancel
     * @throws RenderException
     */
    public function render(RenderOptions $o, ?callable $onProgress = null, ?callable $shouldCancel = null): void
    {
        $caps = $this->capabilities();
        if (!$caps['libass']) {
            throw new RenderException($caps['error'] ?? 'FFmpeg is not available.');
        }
        if (!is_file($o->inputPath)) {
            throw new RenderException('The source video file is missing.');
        }
        @mkdir(dirname($o->outputPath), 0755, true);

        $buffer = '';
        $lastPercent = -1;
        $result = $this->runner->run(
            $this->buildCommand($o),
            function (string $chunk) use (&$buffer, &$lastPercent, $o, $onProgress) {
                $buffer .= $chunk;
                while (($nl = strpos($buffer, "\n")) !== false) {
                    $line = substr($buffer, 0, $nl);
                    $buffer = substr($buffer, $nl + 1);
                    $percent = self::parseProgressLine($line, $o->durationSeconds);
                    if ($percent !== null && $percent !== $lastPercent && $onProgress) {
                        $lastPercent = $percent;
                        $onProgress($percent);
                    }
                }
            },
            $shouldCancel,
            (float) config('captions.render_timeout', 3600),
        );

        if ($result['stopped']) {
            @unlink($o->outputPath);
            throw new RenderException('Rendering was cancelled.', cancelled: true);
        }
        if ($result['exitCode'] !== 0 || !is_file($o->outputPath) || filesize($o->outputPath) === 0) {
            @unlink($o->outputPath);
            throw new RenderException('FFmpeg failed to render the video.', self::tail($result['stderr']));
        }
    }

    /** Parses one `-progress` line; returns 0–99 while encoding, 100 at the end, null otherwise. */
    public static function parseProgressLine(string $line, float $duration): ?int
    {
        $line = trim($line);
        if ($line === 'progress=end') {
            return 100;
        }
        if ($duration > 0 && preg_match('/^out_time_(?:us|ms)=(\d+)$/', $line, $m)) {
            return (int) min(99, max(0, floor((int) $m[1] / 1_000_000 / $duration * 100)));
        }

        return null;
    }

    protected static function tail(string $stderr, int $lines = 12): string
    {
        $all = preg_split('/\r?\n/', trim($stderr)) ?: [];

        return implode("\n", array_slice($all, -$lines));
    }
}
