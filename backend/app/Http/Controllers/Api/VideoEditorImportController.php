<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Media\LinkDownloader;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Media for the video editor from a link (TikTok or a direct file link), sent back as a file. Nothing is stored. */
class VideoEditorImportController extends Controller
{
    public function link(Request $request, LinkDownloader $downloader, UsageService $usage): BinaryFileResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2000'],
            'confirm_rights' => ['accepted'],
        ], ['confirm_rights.accepted' => 'Confirm that you own this video or have permission to use it.']);

        $maxMb = $usage->limits($request->user())['max_upload_mb'] ?? null;
        $file = $downloader->download($validated['url'], (int) (($maxMb ?: 4096) * 1048576));
        AppLog::info('editor.link_imported', ['user' => $request->user()->id, 'host' => parse_url($validated['url'], PHP_URL_HOST), 'bytes' => $file['bytes']]);

        return response()
            ->download($file['path'], $file['name'], ['Content-Type' => $file['mime'], 'Cache-Control' => 'no-store'])
            ->deleteFileAfterSend();
    }
}
