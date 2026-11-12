<?php

namespace Tests\Unit;

use App\Services\Rendering\FilterEscaper;
use App\Services\Rendering\ProcessRunner;
use App\Services\Rendering\RenderException;
use App\Services\Rendering\RenderOptions;
use App\Services\Rendering\VideoRendererService;
use Tests\TestCase;

/**
 * The FFmpeg abstraction, tested without FFmpeg: a fake ProcessRunner records the
 * argv and plays back canned output.
 */
class VideoRendererServiceTest extends TestCase
{
    private function fakeRunner(array $responses): ProcessRunner
    {
        return new class($responses) extends ProcessRunner {
            public array $commands = [];

            public function __construct(private array $responses) {}

            public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
            {
                $this->commands[] = $command;
                $r = array_shift($this->responses) ?? ['exitCode' => 0, 'stdout' => '', 'stderr' => ''];
                if (isset($r['write'])) {
                    file_put_contents($r['write'], 'fake mp4');
                }
                if ($onStdout && $r['stdout'] !== '') {
                    foreach (str_split($r['stdout'], 7) as $chunk) {
                        $onStdout($chunk);
                    }
                }
                $stopped = $shouldStop ? $shouldStop() : false;

                return ['exitCode' => $r['exitCode'], 'stdout' => $r['stdout'], 'stderr' => $r['stderr'] ?? '', 'stopped' => $stopped];
            }
        };
    }

    private const FILTERS_WITH_LIBASS = " .. ass               V->V       Render ASS subtitles onto input video using the libass library.\n";

    private function renderOptions(string $dir, array $over = []): RenderOptions
    {
        $input = "{$dir}/in put's [video].mp4";
        file_put_contents($input, 'x');

        return new RenderOptions(...array_merge([
            'inputPath' => $input,
            'subtitlePath' => "{$dir}/caps:1, 'a'.ass",
            'outputPath' => "{$dir}/out.mp4",
            'fontsDir' => "{$dir}/fonts",
            'width' => 1280,
            'height' => 720,
            'crf' => 22,
            'preset' => 'medium',
            'audioBitrate' => '160k',
            'durationSeconds' => 10,
        ], $over));
    }

    private function tmp(): string
    {
        $dir = sys_get_temp_dir() . '/render-test-' . bin2hex(random_bytes(4));
        mkdir($dir);

        return $dir;
    }

    public function test_filter_escaping_matches_ffmpeg_documentation(): void
    {
        // Example from ffmpeg-filters "Notes on filtergraph escaping".
        $this->assertSame(
            "this is a \\\\\\'string\\\\\\'\\\\: may contain one\\, or more\\, special characters",
            FilterEscaper::optionValue("this is a 'string': may contain one, or more, special characters"),
        );
        $this->assertSame('a\\\\\\\\b\\[c\\]\\;d', FilterEscaper::optionValue('a\\b[c];d'));

        $this->expectException(\InvalidArgumentException::class);
        FilterEscaper::optionValue("bad\0path");
    }

    public function test_command_is_an_argv_array_with_escaped_paths(): void
    {
        $dir = $this->tmp();
        $svc = new VideoRendererService($this->fakeRunner([]), '/usr/bin/ffmpeg');
        $cmd = $svc->buildCommand($this->renderOptions($dir));

        $this->assertSame('/usr/bin/ffmpeg', $cmd[0]);
        $this->assertContains('file:' . "{$dir}/in put's [video].mp4", $cmd, 'input passed as one argv item with file: prefix');
        $this->assertSame('file:' . "{$dir}/out.mp4", end($cmd));
        $vf = $cmd[array_search('-vf', $cmd, true) + 1];
        $this->assertStringContainsString('scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:', $vf);
        $this->assertStringContainsString('ass=filename=' . FilterEscaper::optionValue("{$dir}/caps:1, 'a'.ass") . ':fontsdir=', $vf);
        $this->assertStringNotContainsString("caps:1, 'a'", $vf, 'raw special characters never reach the filtergraph');
        $this->assertSame('22', $cmd[array_search('-crf', $cmd, true) + 1]);
    }

    public function test_render_options_reject_unsafe_encoder_values(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new RenderOptions('i', 's', 'o', 'f', 1280, 720, 22, 'medium -vf evil', '160k');
    }

    public function test_output_size_follows_aspect_and_resolution(): void
    {
        $this->assertSame([1920, 1080], VideoRendererService::outputSize(3840, 2160, 'source', 1080));
        $this->assertSame([1080, 1920], VideoRendererService::outputSize(1920, 1080, '9:16', 1080));
        $this->assertSame([720, 720], VideoRendererService::outputSize(1920, 1080, '1:1', 720));
        $this->assertSame([1280, 720], VideoRendererService::outputSize(1280, 720, 'source', null));
        $this->assertSame([406, 720], VideoRendererService::outputSize(405, 720, 'source', null), 'odd sizes become even');
    }

    public function test_progress_lines_are_parsed(): void
    {
        $this->assertSame(50, VideoRendererService::parseProgressLine('out_time_us=5000000', 10));
        $this->assertSame(99, VideoRendererService::parseProgressLine('out_time_ms=15000000', 10));
        $this->assertSame(100, VideoRendererService::parseProgressLine('progress=end', 10));
        $this->assertNull(VideoRendererService::parseProgressLine('frame=12', 10));
    }

    public function test_missing_libass_gives_a_clear_error(): void
    {
        $svc = new VideoRendererService($this->fakeRunner([['exitCode' => 0, 'stdout' => " .. overlay  VV->V  Overlay\n"]]), 'ffmpeg');

        $this->assertFalse($svc->capabilities()['libass']);
        $this->expectException(RenderException::class);
        $this->expectExceptionMessage('no libass');
        $svc->render($this->renderOptions($this->tmp()));
    }

    public function test_successful_render_reports_progress(): void
    {
        $dir = $this->tmp();
        $runner = $this->fakeRunner([
            ['exitCode' => 0, 'stdout' => self::FILTERS_WITH_LIBASS],
            ['exitCode' => 0, 'stdout' => "frame=1\nout_time_us=2500000\nprogress=continue\nout_time_us=7500000\nprogress=end\n", 'write' => "{$dir}/out.mp4"],
        ]);
        $progress = [];
        (new VideoRendererService($runner, 'ffmpeg'))->render($this->renderOptions($dir), function ($p) use (&$progress) {
            $progress[] = $p;
        });

        $this->assertSame([25, 75, 100], $progress);
        $this->assertFileExists("{$dir}/out.mp4");
    }

    public function test_ffmpeg_failure_hides_stderr_from_the_message(): void
    {
        $dir = $this->tmp();
        $runner = $this->fakeRunner([
            ['exitCode' => 0, 'stdout' => self::FILTERS_WITH_LIBASS],
            ['exitCode' => 1, 'stdout' => '', 'stderr' => "/secret/server/path: Invalid data\n"],
        ]);

        try {
            (new VideoRendererService($runner, 'ffmpeg'))->render($this->renderOptions($dir));
            $this->fail('Expected RenderException');
        } catch (RenderException $e) {
            $this->assertSame('FFmpeg failed to render the video.', $e->getMessage());
            $this->assertStringContainsString('/secret/server/path', $e->details);
        }
    }

    public function test_cancellation_stops_rendering(): void
    {
        $dir = $this->tmp();
        $runner = $this->fakeRunner([
            ['exitCode' => 0, 'stdout' => self::FILTERS_WITH_LIBASS],
            ['exitCode' => 255, 'stdout' => '', 'write' => "{$dir}/out.mp4"],
        ]);

        try {
            (new VideoRendererService($runner, 'ffmpeg'))->render($this->renderOptions($dir), shouldCancel: fn () => true);
            $this->fail('Expected RenderException');
        } catch (RenderException $e) {
            $this->assertTrue($e->cancelled);
            $this->assertFileDoesNotExist("{$dir}/out.mp4", 'partial output is removed');
        }
    }
}
