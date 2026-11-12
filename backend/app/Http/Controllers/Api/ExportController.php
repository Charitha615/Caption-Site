<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Exports\StoreExportRequest;
use App\Http\Resources\ExportResource;
use App\Models\Export;
use App\Models\Project;
use App\Services\Export\ExportService;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    protected const MIME = [
        'srt' => 'application/x-subrip; charset=utf-8',
        'vtt' => 'text/vtt; charset=utf-8',
        'txt' => 'text/plain; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'mp4' => 'video/mp4',
    ];

    public function __construct(protected ExportService $exports) {}

    public function index(Project $project): JsonResponse
    {
        $this->authorize('view', $project);

        $exports = $project->exports()->latest()->limit(50)->get();

        return $this->successResponse([
            'exports' => ExportResource::collection($exports),
        ], 'Exports retrieved');
    }

    public function store(StoreExportRequest $request, Project $project): JsonResponse
    {
        $export = $this->exports->create($project, $request->user(), $request->validated());

        return $this->successResponse([
            'export' => new ExportResource($export),
        ], $export->type === 'mp4' ? 'Video export queued' : 'Export ready', 201);
    }

    public function show(Export $export): JsonResponse
    {
        $this->authorize('view', $export);

        return $this->successResponse(['export' => new ExportResource($export)], 'Export retrieved');
    }

    public function destroy(Export $export): JsonResponse
    {
        $this->authorize('delete', $export);

        $this->exports->delete($export);

        return $this->successResponse(null, 'Export deleted');
    }

    /**
     * Reached only through a temporary signed URL (route middleware 'signed'), which the
     * API hands out exclusively to the export's owner. No filesystem path is ever exposed.
     */
    public function download(Export $export): StreamedResponse|JsonResponse
    {
        $disk = Storage::disk($this->exports->disk());
        if (!$export->isDownloadable() || !$disk->exists($export->file_path)) {
            return $this->errorResponse('This export is not available for download.', 404);
        }

        return $disk->download($export->file_path, $export->downloadFileName(), [
            'Content-Type' => self::MIME[$export->type] ?? 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
