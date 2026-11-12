<?php

namespace Tests\Unit;

use App\Services\Caption\SubtitleFormatterService;
use PHPUnit\Framework\TestCase;

class SubtitleFormatterTest extends TestCase
{
    private SubtitleFormatterService $f;

    protected function setUp(): void
    {
        parent::setUp();
        $this->f = new SubtitleFormatterService();
    }

    private function captions(): array
    {
        return [
            ['sequence' => 2, 'start_time' => 3.5, 'end_time' => 6.0, 'text' => 'ශ්‍රී ලංකාව & <AI>', 'language' => 'si'],
            ['sequence' => 1, 'start_time' => 0.5, 'end_time' => 3.2, 'text' => 'ආයුබෝවන්', 'language' => 'si'],
            ['sequence' => 3, 'start_time' => 6.2, 'end_time' => 7.0, 'text' => '   ', 'language' => 'si'],
            ['sequence' => 4, 'start_time' => 3661.25, 'end_time' => 3662.0, 'text' => "Line one\n\n\nLine two", 'language' => 'en'],
        ];
    }

    public function test_srt_is_numbered_sorted_and_skips_empty_cues(): void
    {
        $srt = $this->f->toSrt($this->captions());

        $expected = "1\n00:00:00,500 --> 00:00:03,200\nආයුබෝවන්\n\n"
            . "2\n00:00:03,500 --> 00:00:06,000\nශ්‍රී ලංකාව & <AI>\n\n"
            . "3\n01:01:01,250 --> 01:01:02,000\nLine one\nLine two\n";

        $this->assertSame($expected, $srt);
    }

    public function test_srt_preserves_sinhala_zwj_bytes(): void
    {
        $srt = $this->f->toSrt([['start_time' => 0, 'end_time' => 1, 'text' => "ශ්\u{200D}රී"]]);

        $this->assertStringContainsString("ශ්\u{200D}රී", $srt);
        $this->assertTrue(mb_check_encoding($srt, 'UTF-8'));
    }

    public function test_timestamps_never_overflow_milliseconds(): void
    {
        $this->assertSame('00:01:00,000', $this->f->timestamp(59.9996, ','));
        $this->assertSame('00:00:00,000', $this->f->timestamp(-1, ','));
        $this->assertSame('10:00:00.001', $this->f->timestamp(36000.001, '.'));
    }

    public function test_vtt_has_header_and_escapes_markup(): void
    {
        $vtt = $this->f->toVtt($this->captions());

        $this->assertStringStartsWith("WEBVTT\n\n00:00:00.500 --> 00:00:03.200\nආයුබෝවන්\n", $vtt);
        $this->assertStringContainsString('ශ්‍රී ලංකාව &amp; &lt;AI&gt;', $vtt);
        $this->assertStringNotContainsString('<AI>', $vtt);
    }

    public function test_cue_text_can_never_contain_an_arrow(): void
    {
        $vtt = $this->f->toVtt([['start_time' => 0, 'end_time' => 1, 'text' => 'a --> b']]);

        $this->assertSame(1, substr_count($vtt, '-->'));
    }

    public function test_txt_and_json(): void
    {
        $this->assertSame("ආයුබෝවන්\n\nශ්‍රී ලංකාව & <AI>\n\nLine one\n\n\nLine two\n", $this->f->toTxt($this->captions()));

        $json = json_decode($this->f->toJson($this->captions(), ['project' => ['name' => 'පරීක්ෂණය']]), true);
        $this->assertSame(1, $json['version']);
        $this->assertSame('පරීක්ෂණය', $json['project']['name']);
        $this->assertCount(4, $json['captions']);
        $this->assertSame(['sequence' => 1, 'start' => 0.5, 'end' => 3.2, 'text' => 'ආයුබෝවන්', 'language' => 'si'], $json['captions'][0]);
        $this->assertStringContainsString('ආයුබෝවන්', $this->f->toJson($this->captions()), 'JSON keeps Unicode unescaped');
    }
}
