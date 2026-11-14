<?php

namespace Tests\Unit;

use App\Exceptions\VideoProcessingException;
use App\Services\Rendering\ProcessRunner;
use App\Services\Video\FFmpegService;
use Tests\TestCase;

class FFmpegServiceTest extends TestCase
{
    private function serviceReturning(int $exitCode, string $stdout = '', string $stderr = ''): FFmpegService
    {
        $runner = new class($exitCode, $stdout, $stderr) extends ProcessRunner
        {
            public function __construct(private int $code, private string $out, private string $err) {}

            public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
            {
                return ['exitCode' => $this->code, 'stdout' => $this->out, 'stderr' => $this->err, 'stopped' => false];
            }
        };

        return new FFmpegService($runner);
    }

    public function test_missing_ffprobe_is_reported_as_a_server_problem_not_a_bad_video(): void
    {
        try {
            $this->serviceReturning(127, '', 'sh: ffprobe: not found')->getMetadata('/tmp/v.mp4');
            $this->fail('Expected VideoProcessingException');
        } catch (VideoProcessingException $e) {
            $this->assertStringContainsString('FFmpeg is not installed', $e->getMessage());
            $this->assertStringNotContainsString('could not be read as a video', $e->getMessage());
        }
    }

    public function test_unreadable_file_is_reported_as_invalid_video(): void
    {
        $this->expectExceptionMessage('could not be read as a video');
        $this->serviceReturning(1, '', 'Invalid data found when processing input')->getMetadata('/tmp/v.mp4');
    }

    public function test_metadata_is_parsed_and_rotation_swaps_dimensions(): void
    {
        $json = json_encode(['streams' => [
            ['codec_type' => 'video', 'codec_name' => 'h264', 'width' => 1920, 'height' => 1080, 'avg_frame_rate' => '30000/1001', 'tags' => ['rotate' => '90']],
            ['codec_type' => 'audio', 'codec_name' => 'aac', 'sample_rate' => '48000', 'channels' => 2],
        ], 'format' => ['duration' => '12.5']]);

        $meta = $this->serviceReturning(0, $json)->getMetadata('/tmp/v.mp4');

        $this->assertSame([1080, 1920], [$meta['width'], $meta['height']]);
        $this->assertSame(12.5, $meta['duration']);
        $this->assertSame(29.97, $meta['fps']);
        $this->assertTrue($meta['has_audio']);
    }
}
