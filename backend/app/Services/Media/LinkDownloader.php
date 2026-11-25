<?php

namespace App\Services\Media;

use App\Exceptions\UserFacingException;
use App\Services\Rendering\ProcessRunner;
use App\Support\AppLog;
use Closure;
use GuzzleHttp\Cookie\CookieJar;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Downloads a video, audio or image from a link for the video editor (which can't fetch other sites
 * from the browser): a TikTok post (TikTok's own stream without the watermark overlay) or a direct
 * link to a media file.
 *
 * TikTok links go through yt-dlp first (TikTok often answers servers with a bot check); reading
 * the post's page is the fallback when yt-dlp is missing or fails.
 *
 * The server fetches what users point it at, so every hop is checked: http(s) only, the host must
 * resolve to public addresses only, and the connection is pinned to the address that was checked
 * (no DNS rebinding). Downloads stop at the size limit.
 */
class LinkDownloader
{
    private const MAX_REDIRECTS = 5;

    private const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private const MEDIA_EXTENSIONS = [
        'video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/x-matroska' => 'mkv',
        'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav',
        'audio/ogg' => 'ogg', 'audio/webm' => 'webm', 'audio/aac' => 'aac', 'audio/flac' => 'flac',
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp',
    ];

    /** @var Closure(string): list<string> host → IP addresses */
    private Closure $resolver;

    private ProcessRunner $runner;

    public function __construct(?Closure $resolver = null, ?ProcessRunner $runner = null)
    {
        $this->runner = $runner ?? new ProcessRunner;
        $this->resolver = $resolver ?? fn (string $host): array => array_values(array_unique(array_merge(
            gethostbynamel($host) ?: [],
            array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6'),
        )));
    }

    public static function isTikTok(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return $host === 'tiktok.com' || str_ends_with($host, '.tiktok.com');
    }

    /**
     * Downloads the media behind the link to a temporary file. The caller deletes it.
     *
     * @return array{path: string, name: string, mime: string, bytes: int}
     *
     * @throws UserFacingException
     */
    public function download(string $url, int $maxBytes): array
    {
        $url = trim($url);
        if (self::isTikTok($url)) {
            $file = $this->tiktokWithYtDlp($url, $maxBytes);
            if ($file !== null) {
                return $file;
            }
            [$mediaUrl, $name, $headers, $jar] = $this->tiktok($url);

            return $this->fetchMedia($mediaUrl, $name, $maxBytes, $headers, $jar);
        }

        return $this->fetchMedia($url, null, $maxBytes);
    }

    /**
     * Downloads a TikTok post with yt-dlp, preferring a stream without the watermark.
     * Returns null when yt-dlp is not installed or could not get the video, so the caller can fall back.
     *
     * @return array{path: string, name: string, mime: string, bytes: int}|null
     *
     * @throws UserFacingException when the video is over the size limit
     */
    private function tiktokWithYtDlp(string $url, int $maxBytes): ?array
    {
        $binary = (string) config('captions.ytdlp_binary');
        if ($binary === '' || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https') {
            return null;
        }
        $storage = app(MediaStorage::class);
        $dir = $storage->tempPath('ytdlp');
        File::ensureDirectoryExists($dir, 0700);
        try {
            $result = $this->runner->run([
                $binary, '--ignore-config', '--no-playlist', '--no-warnings', '--no-progress', '--restrict-filenames',
                '--max-filesize', (string) $maxBytes,
                // H.264 first: browsers often can't decode TikTok's H.265 (bytevc1) streams, so the
                // preview stays black while the sound plays. Skip the watermarked "download" copy.
                '-f', 'b[vcodec^=h264][acodec!=none][format_note!*=?watermark][format_id!*=?download]'
                    .'/b[vcodec^=avc][acodec!=none][format_id!*=?download]'
                    .'/b[vcodec!=none][acodec!=none][format_note!*=?watermark][format_id!*=?download]/b',
                '-o', $dir.'/tiktok-%(uploader)s-%(id)s.%(ext)s',
                '--print', 'after_move:filepath',
                '--', $url,
            ], timeout: 300);
        } catch (\Throwable $e) {
            File::deleteDirectory($dir);
            AppLog::warning('link.ytdlp_unavailable', ['error' => $e->getMessage()]);

            return null;
        }
        $files = File::files($dir);
        if ($result['exitCode'] !== 0 || $files === []) {
            File::deleteDirectory($dir);
            // yt-dlp skips (and still exits 0) when the file is over --max-filesize.
            if ($result['exitCode'] === 0) {
                throw new UserFacingException('This file is bigger than your plan allows ('.round($maxBytes / 1048576).' MB).');
            }
            AppLog::warning('link.ytdlp_failed', ['exit' => $result['exitCode'], 'error' => Str::limit(trim($result['stderr']), 500)]);

            return null;
        }
        $file = $files[0];
        $name = $file->getFilename();
        $path = $storage->tempPath('part');
        File::move($file->getPathname(), $path);
        File::deleteDirectory($dir);
        $bytes = (int) filesize($path);
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if ($bytes > $maxBytes || ! isset(self::MEDIA_EXTENSIONS[$mime])) {
            @unlink($path);
            if ($bytes > $maxBytes) {
                throw new UserFacingException('This file is bigger than your plan allows ('.round($maxBytes / 1048576).' MB).');
            }
            AppLog::warning('link.ytdlp_not_media', ['mime' => $mime]);

            return null;
        }

        return ['path' => $path, 'name' => $name, 'mime' => $mime, 'bytes' => $bytes];
    }

    /**
     * The watermark-free stream of a TikTok post, read from the post's page.
     *
     * @return array{0: string, 1: string, 2: array<string, string>, 3: CookieJar}
     */
    private function tiktok(string $url): array
    {
        $jar = new CookieJar;
        $headers = ['User-Agent' => self::BROWSER_UA, 'Accept-Language' => 'en-US,en;q=0.9', 'Accept' => 'text/html,application/xhtml+xml'];
        // Short links (vm.tiktok.com/…, tiktok.com/t/…) redirect to the post.
        [$page, $finalUrl] = $this->get($url, $headers, $jar);
        if (! $page->successful()) {
            throw new UserFacingException('TikTok did not open this link. Check that the video is public.', ['status' => $page->status()]);
        }
        $html = (string) $page->body();
        $item = self::tiktokItem($html);
        if ($item === null && self::isBotCheck($html)) {
            AppLog::warning('link.tiktok_bot_check', ['url' => $finalUrl]);
            throw new UserFacingException('TikTok blocked the download with a bot check. Download the video from the TikTok app (Save video) and upload the file to Media instead.');
        }
        if ($item === null) {
            AppLog::warning('link.tiktok_unreadable', ['url' => $finalUrl]);
            throw new UserFacingException('Could not read this TikTok post. It may be private, removed, or not available in your region.');
        }
        $video = $item['video'] ?? [];
        // playAddr / bitrate streams are the plain video; downloadAddr is the copy with TikTok's watermark.
        $candidates = [];
        foreach ((array) ($video['bitrateInfo'] ?? []) as $rate) {
            foreach ((array) ($rate['PlayAddr']['UrlList'] ?? []) as $u) {
                $codec = strtolower((string) ($rate['CodecType'] ?? ''));
                $candidates[] = ['url' => $u, 'rate' => (int) ($rate['Bitrate'] ?? 0), 'h264' => $codec === '' || str_contains($codec, '264')];
            }
        }
        // H.264 before H.265 (which many browsers can't play), then the highest bitrate.
        usort($candidates, fn ($a, $b) => [$b['h264'], $b['rate']] <=> [$a['h264'], $a['rate']]);
        $urls = array_values(array_filter([...array_column($candidates, 'url'), $video['playAddr'] ?? null], fn ($u) => is_string($u) && str_starts_with($u, 'http')));
        if ($urls === []) {
            if (! empty($item['imagePost'])) {
                throw new UserFacingException('This TikTok is a photo post, not a video.');
            }
            throw new UserFacingException('This TikTok has no downloadable video.');
        }
        $author = Str::slug((string) ($item['author']['uniqueId'] ?? $item['author'] ?? 'tiktok')) ?: 'tiktok';
        $name = "tiktok-{$author}-".preg_replace('/\D/', '', (string) ($item['id'] ?? '')).'.mp4';

        return [$urls[0], $name, ['User-Agent' => self::BROWSER_UA, 'Referer' => 'https://www.tiktok.com/', 'Accept' => '*/*'], $jar];
    }

    /** Whether TikTok answered with its "Please wait…" bot-check page instead of the post. */
    public static function isBotCheck(string $html): bool
    {
        return str_contains($html, '_wafchallengeid') || str_contains($html, 'SlardarWAF');
    }

    /**
     * The post data in a TikTok page (current and older page formats).
     *
     * @return array<string, mixed>|null
     */
    public static function tiktokItem(string $html): ?array
    {
        foreach (['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE'] as $id) {
            if (! preg_match('/<script[^>]+id="'.$id.'"[^>]*>(.*?)<\/script>/s', $html, $m)) {
                continue;
            }
            $data = json_decode(html_entity_decode($m[1]), true);
            if (! is_array($data)) {
                continue;
            }
            $item = $data['__DEFAULT_SCOPE__']['webapp.video-detail']['itemInfo']['itemStruct'] ?? null;
            if (is_array($item)) {
                return $item;
            }
            $module = $data['ItemModule'] ?? null;
            if (is_array($module) && $module !== []) {
                return reset($module);
            }
        }

        return null;
    }

    /**
     * Streams a media file to a temporary path, refusing anything that isn't video, audio or an image.
     *
     * @param  array<string, string>  $headers
     * @return array{path: string, name: string, mime: string, bytes: int}
     */
    private function fetchMedia(string $url, ?string $name, int $maxBytes, array $headers = [], ?CookieJar $jar = null): array
    {
        $path = app(MediaStorage::class)->tempPath('part');
        $headers += ['User-Agent' => self::BROWSER_UA, 'Accept' => '*/*'];
        try {
            [$response, $finalUrl] = $this->get($url, $headers, $jar, [
                'sink' => $path,
                'on_headers' => function ($r) use ($maxBytes) {
                    if ((int) $r->getHeaderLine('Content-Length') > $maxBytes) {
                        throw new UserFacingException('This file is bigger than your plan allows ('.round($maxBytes / 1048576).' MB).');
                    }
                },
                'progress' => function ($total, $downloaded) use ($maxBytes) {
                    if ($downloaded > $maxBytes) {
                        throw new UserFacingException('This file is bigger than your plan allows ('.round($maxBytes / 1048576).' MB).');
                    }
                },
            ]);
            if (! $response->successful()) {
                throw new UserFacingException('The link could not be downloaded (the site answered '.$response->status().').');
            }
            // Fake responses in tests don't write to the sink.
            if (! is_file($path) || filesize($path) === 0) {
                File::put($path, (string) $response->body());
            }
            $bytes = (int) filesize($path);
            if ($bytes === 0) {
                throw new UserFacingException('The link gave an empty file.');
            }
            if ($bytes > $maxBytes) {
                throw new UserFacingException('This file is bigger than your plan allows ('.round($maxBytes / 1048576).' MB).');
            }
            $mime = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));
            if (! isset(self::MEDIA_EXTENSIONS[$mime])) {
                // Servers often send octet-stream; trust the file's own signature then.
                $sniffed = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($path);
                $mime = isset(self::MEDIA_EXTENSIONS[$sniffed]) ? $sniffed : $mime;
            }
            if (! isset(self::MEDIA_EXTENSIONS[$mime])) {
                throw new UserFacingException('This link is not a video, audio or image file. Paste a TikTok link or a direct link to a media file.', ['mime' => $mime]);
            }
            $ext = self::MEDIA_EXTENSIONS[$mime];
            $name ??= self::nameFromUrl($finalUrl, $ext);

            return ['path' => $path, 'name' => $name, 'mime' => $mime, 'bytes' => $bytes];
        } catch (\Throwable $e) {
            @unlink($path);
            if ($e instanceof UserFacingException) {
                throw $e;
            }
            // Guzzle wraps exceptions thrown from callbacks.
            if ($e->getPrevious() instanceof UserFacingException) {
                throw $e->getPrevious();
            }
            AppLog::warning('link.download_failed', ['error' => $e->getMessage()]);
            throw new UserFacingException('The link could not be downloaded. Check it and try again.', [], 422, 'request_failed', $e);
        }
    }

    public static function nameFromUrl(string $url, string $ext): string
    {
        $base = pathinfo((string) parse_url($url, PHP_URL_PATH), PATHINFO_FILENAME);
        $base = Str::limit(preg_replace('/[^\w\-. ]+/u', '', urldecode($base)) ?: 'download', 80, '');

        return "{$base}.{$ext}";
    }

    /**
     * GET with redirects followed by hand, so every hop's host is checked and the connection is
     * pinned to the checked address.
     *
     * @param  array<string, string>  $headers
     * @param  array<string, mixed>  $options
     * @return array{0: Response, 1: string}
     */
    private function get(string $url, array $headers, ?CookieJar $jar = null, array $options = []): array
    {
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            [$host, $port, $ip] = $this->checkUrl($url);
            $response = Http::withHeaders($headers)
                ->withoutRedirecting()
                ->connectTimeout(15)
                ->timeout(300)
                ->withOptions($options + array_filter([
                    'cookies' => $jar,
                    'curl' => [CURLOPT_RESOLVE => ["{$host}:{$port}:".(str_contains($ip, ':') ? "[{$ip}]" : $ip)]],
                ]))
                ->get($url);
            if (! in_array($response->status(), [301, 302, 303, 307, 308], true)) {
                return [$response, $url];
            }
            $location = $response->header('Location');
            if ($location === '') {
                return [$response, $url];
            }
            $url = (string) UriResolver::resolve(new Uri($url), new Uri($location));
        }

        throw new UserFacingException('The link redirects too many times.');
    }

    /**
     * @return array{0: string, 1: int, 2: string} host, port, a checked public IP
     */
    private function checkUrl(string $url): array
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
            throw new UserFacingException('Paste a full web link starting with https://');
        }
        $port = (int) ($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
        if (! in_array($port, [80, 443, 8080, 8443], true)) {
            throw new UserFacingException('Links on unusual ports are not supported.');
        }
        $ips = filter_var(trim($host, '[]'), FILTER_VALIDATE_IP) ? [trim($host, '[]')] : ($this->resolver)($host);
        if ($ips === []) {
            throw new UserFacingException('This website could not be found. Check the link.');
        }
        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                AppLog::warning('link.blocked_host', ['host' => $host, 'ip' => $ip]);
                throw new UserFacingException('This link points to a private address and cannot be downloaded.');
            }
        }

        return [$host, $port, $ips[0]];
    }
}
