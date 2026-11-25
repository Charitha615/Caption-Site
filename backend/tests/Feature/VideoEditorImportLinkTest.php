<?php

namespace Tests\Feature;

use App\Services\Media\LinkDownloader;
use App\Services\Rendering\ProcessRunner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VideoEditorImportLinkTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, list<string>> */
    private array $dns = [];

    /** What the fake yt-dlp writes: null = it fails, so the page reader is used. */
    private ?string $ytDlpFile = null;

    /** @var list<list<string>> */
    private array $ytDlpCalls = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->dns = ['www.tiktok.com' => ['142.250.1.1'], 'vm.tiktok.com' => ['142.250.1.2'], 'v16.tiktokcdn.com' => ['142.250.1.3'], 'cdn.example.com' => ['93.184.216.34']];
        $test = $this;
        $runner = new class($test) extends ProcessRunner
        {
            public function __construct(private VideoEditorImportLinkTest $test) {}

            public function run(array $command, ?callable $onStdout = null, ?callable $shouldStop = null, ?float $timeout = null): array
            {
                return $this->test->fakeYtDlp($command);
            }
        };
        $this->app->instance(LinkDownloader::class, new LinkDownloader(fn (string $host) => $this->dns[$host] ?? [], $runner));
    }

    /**
     * @param  list<string>  $command
     * @return array{exitCode: int, stdout: string, stderr: string, stopped: bool}
     */
    public function fakeYtDlp(array $command): array
    {
        $this->ytDlpCalls[] = $command;
        if ($this->ytDlpFile === null) {
            return ['exitCode' => 1, 'stdout' => '', 'stderr' => 'ERROR: Unable to extract', 'stopped' => false];
        }
        $template = $command[array_search('-o', $command, true) + 1];
        $path = str_replace(['%(uploader)s', '%(id)s', '%(ext)s'], ['kandy', '123', 'mp4'], $template);
        file_put_contents($path, $this->ytDlpFile);

        return ['exitCode' => 0, 'stdout' => $path, 'stderr' => '', 'stopped' => false];
    }

    public function test_tiktok_links_download_with_yt_dlp_first(): void
    {
        $this->ytDlpFile = "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom".str_repeat("\x00", 64);
        Http::fake();

        $response = $this->import('https://vt.tiktok.com/ZSabc/');

        $response->assertOk()->assertHeader('Content-Type', 'video/mp4');
        $this->assertStringContainsString('tiktok-kandy-123.mp4', (string) $response->headers->get('Content-Disposition'));
        $this->assertSame(['--', 'https://vt.tiktok.com/ZSabc/'], array_slice($this->ytDlpCalls[0], -2));
        Http::assertNothingSent();
    }

    private function tiktokPage(array $item): string
    {
        $data = ['__DEFAULT_SCOPE__' => ['webapp.video-detail' => ['itemInfo' => ['itemStruct' => $item]]]];

        return '<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">'.json_encode($data).'</script></html>';
    }

    private function import(string $url, bool $confirm = true)
    {
        [, $headers] = $this->userWithToken();

        return $this->withHeaders($headers)->postJson('/api/video-editor/import-link', ['url' => $url, 'confirm_rights' => $confirm]);
    }

    public function test_a_tiktok_short_link_downloads_the_best_stream_without_the_watermark(): void
    {
        Http::fake([
            'vm.tiktok.com/*' => Http::response('', 302, ['Location' => 'https://www.tiktok.com/@kandy.foods/video/7301234567890']),
            'www.tiktok.com/*' => Http::response($this->tiktokPage([
                'id' => '7301234567890',
                'author' => ['uniqueId' => 'kandy.foods'],
                'video' => [
                    'playAddr' => 'https://v16.tiktokcdn.com/play-low.mp4',
                    'downloadAddr' => 'https://v16.tiktokcdn.com/watermarked.mp4',
                    'bitrateInfo' => [
                        ['Bitrate' => 500000, 'PlayAddr' => ['UrlList' => ['https://v16.tiktokcdn.com/play-500.mp4']]],
                        ['Bitrate' => 1800000, 'CodecType' => 'h264', 'PlayAddr' => ['UrlList' => ['https://v16.tiktokcdn.com/play-1800.mp4']]],
                        ['Bitrate' => 2500000, 'CodecType' => 'h265_hvc1', 'PlayAddr' => ['UrlList' => ['https://v16.tiktokcdn.com/play-h265.mp4']]],
                    ],
                ],
            ]), 200, ['Set-Cookie' => 'tt_chain_token=abc; Path=/; Domain=.tiktok.com']),
            'v16.tiktokcdn.com/play-1800.mp4' => Http::response('MP4-BYTES', 200, ['Content-Type' => 'video/mp4']),
        ]);

        $response = $this->import('https://vm.tiktok.com/ZSabc123/');

        $response->assertOk()->assertHeader('Content-Type', 'video/mp4');
        $this->assertStringContainsString('tiktok-kandyfoods-7301234567890.mp4', (string) $response->headers->get('Content-Disposition'));
        $this->assertSame('MP4-BYTES', $response->streamedContent());
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'play-1800') && $r->header('Referer')[0] === 'https://www.tiktok.com/');
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'watermarked'));
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'play-h265'));
    }

    public function test_tiktok_photo_posts_and_unreadable_pages_say_why(): void
    {
        Http::fake(['www.tiktok.com/*' => Http::sequence()
            ->push($this->tiktokPage(['id' => '1', 'imagePost' => ['images' => [[]]], 'video' => []]))
            ->push('<html>Please log in</html>')
            ->push('<html><body>Please wait... <p id="wci" class="_wafchallengeid"></p></body></html>')]);

        $this->import('https://www.tiktok.com/@a/photo/1')->assertStatus(422)->assertJsonPath('message', 'This TikTok is a photo post, not a video.');
        $this->import('https://www.tiktok.com/@a/video/2')->assertStatus(422)->assertJsonPath('message', 'Could not read this TikTok post. It may be private, removed, or not available in your region.');
        $this->import('https://www.tiktok.com/@a/video/3')->assertStatus(422)->assertJsonPath('message', 'TikTok blocked the download with a bot check. Download the video from the TikTok app (Save video) and upload the file to Media instead.');
    }

    public function test_a_direct_media_link_is_downloaded_and_other_pages_are_refused(): void
    {
        Http::fake([
            'cdn.example.com/clips/beach%20day.mp4' => Http::response('VIDEO', 200, ['Content-Type' => 'video/mp4']),
            'cdn.example.com/page' => Http::response('<html></html>', 200, ['Content-Type' => 'text/html']),
        ]);

        $response = $this->import('https://cdn.example.com/clips/beach%20day.mp4');
        $response->assertOk();
        $this->assertStringContainsString('beach day.mp4', (string) $response->headers->get('Content-Disposition'));

        $this->import('https://cdn.example.com/page')->assertStatus(422)->assertJsonPath('message', 'This link is not a video, audio or image file. Paste a TikTok link or a direct link to a media file.');
    }

    public function test_private_addresses_bad_links_and_missing_permission_are_refused(): void
    {
        $this->dns['internal.example.com'] = ['10.0.0.5'];
        Http::fake(['cdn.example.com/*' => Http::response('', 302, ['Location' => 'http://internal.example.com/secret'])]);

        $this->import('http://127.0.0.1/admin')->assertStatus(422)->assertJsonPath('message', 'This link points to a private address and cannot be downloaded.');
        $this->import('https://cdn.example.com/redirect')->assertStatus(422)->assertJsonPath('message', 'This link points to a private address and cannot be downloaded.');
        $this->import('file:///etc/passwd')->assertStatus(422)->assertJsonPath('message', 'Paste a full web link starting with https://');
        $this->import('https://cdn.example.com/a.mp4', false)->assertStatus(422)->assertJsonValidationErrors('confirm_rights');
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'internal') || str_contains($r->url(), '127.0.0.1'));
    }

    public function test_files_over_the_plan_limit_are_refused(): void
    {
        config(['plans.plans.free.max_upload_mb' => 1]);
        Http::fake(['cdn.example.com/*' => Http::response(str_repeat('x', 1048577), 200, ['Content-Type' => 'video/mp4'])]);

        $this->import('https://cdn.example.com/big.mp4')->assertStatus(422)->assertJsonPath('message', 'This file is bigger than your plan allows (1 MB).');
    }
}
