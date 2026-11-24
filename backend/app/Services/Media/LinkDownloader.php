<?php

namespace App\Services\Media;

use App\Exceptions\UserFacingException;
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

    public function __construct(?Closure $resolver = null)
    {
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
            [$mediaUrl, $name, $headers, $jar] = $this->tiktok($url);

            return $this->fetchMedia($mediaUrl, $name, $maxBytes, $headers, $jar);
        }

        return $this->fetchMedia($url, null, $maxBytes);
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
        $item = self::tiktokItem((string) $page->body());
        if ($item === null) {
            AppLog::warning('link.tiktok_unreadable', ['url' => $finalUrl]);
            throw new UserFacingException('Could not read this TikTok post. It may be private, removed, or not available in your region.');
        }
        $video = $item['video'] ?? [];
        // playAddr / bitrate streams are the plain video; downloadAddr is the copy with TikTok's watermark.
        $candidates = [];
        foreach ((array) ($video['bitrateInfo'] ?? []) as $rate) {
            foreach ((array) ($rate['PlayAddr']['UrlList'] ?? []) as $u) {
                $candidates[] = ['url' => $u, 'rate' => (int) ($rate['Bitrate'] ?? 0)];
            }
        }
        usort($candidates, fn ($a, $b) => $b['rate'] <=> $a['rate']);
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
