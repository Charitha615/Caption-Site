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

    public function test_audio_is_cut_in_the_middle_of_the_longest_pause_near_each_target(): void
    {
        $silences = [
            ['start' => 50.0, 'end' => 50.4],   // too early (< 60 % of 90 s)
            ['start' => 70.0, 'end' => 70.4],
            ['start' => 95.0, 'end' => 96.2],   // longest pause in the window → cut at 95.6
            ['start' => 180.0, 'end' => 180.8],
        ];

        $parts = FFmpegService::planCuts($silences, 250.0, 90);

        $this->assertSame([[0.0, 95.6], [95.6, 84.8], [180.4, 69.6]], $parts);
        $this->assertSame([[0.0, 100.0]], FFmpegService::planCuts([], 100.0, 90), 'short audio stays whole');
        $this->assertSame([[0.0, 90.0], [90.0, 110.0]], FFmpegService::planCuts([], 200.0, 90), 'no pause → cut at the target');
    }

    public function test_silences_are_parsed_from_silencedetect_output(): void
    {
        $stderr = "[silencedetect @ 0x1] silence_start: 12.5\n[silencedetect @ 0x1] silence_end: 13.25 | silence_duration: 0.75\n[silencedetect @ 0x1] silence_start: 40\n[silencedetect @ 0x1] silence_end: 41.1 | silence_duration: 1.1\n";

        $this->assertSame([['start' => 12.5, 'end' => 13.25], ['start' => 40.0, 'end' => 41.1]], $this->serviceReturning(0, '', $stderr)->detectSilences('/tmp/a.mp3'));
    }
}
