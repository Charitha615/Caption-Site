<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\UploadSession;
use App\Services\Media\MediaIngestService;
use App\Services\Usage\UsageService;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Chunked, resumable uploads.
 *
 *   POST   /projects/{project}/uploads          start (or resume a matching pending session)
 *   GET    /uploads/{upload}                    which chunks the server already has
 *   PUT    /uploads/{upload}/chunks/{index}     raw bytes of one chunk (idempotent)
 *   POST   /uploads/{upload}/complete           assemble, verify, start processing
 *   DELETE /uploads/{upload}                    cancel and discard chunks
 *
 * Chunks are streamed to disk (never buffered whole in PHP memory), sized exactly,
 * and only accepted for the session owner. The assembled file is MIME-checked from
 * its contents before it is stored under a random name on the private media disk.
 */
class UploadSessionController extends Controller
{
    use ApiResponseTrait, AuthorizesRequests;

    public function store(Request $request, Project $project, UsageService $usage, MediaIngestService $ingest): JsonResponse
    {
        $this->authorize('update', $project);

        $validated = $request->validate([
            'file_name' => ['required', 'string', 'max:255'],
            'file_size' => ['required', 'integer', 'min:1'],
            'language' => ['nullable', 'string', Rule::in(['si', 'en', 'auto'])],
        ]);

        $extension = strtolower(pathinfo($validated['file_name'], PATHINFO_EXTENSION));
        if (! in_array($extension, config('captions.uploads.extensions'), true)) {
            throw ValidationException::withMessages(['file_name' => 'Unsupported video format. Allowed formats: MP4, MOV, WEBM, MKV, AVI.']);
        }
        if ($project->isProcessing()) {
            return $this->errorResponse('This project is still processing. Please wait for it to finish.', 409);
        }
        $usage->ensureCanUpload($request->user(), (int) $validated['file_size']);

        $language = $validated['language'] ?? ($project->language ?: 'si');
        $existing = $project->uploadSessions()
            ->where('status', UploadSession::STATUS_PENDING)
            ->where('expires_at', '>', now())
            ->where('original_name', $ingest->displayName($validated['file_name'], 'video'))
            ->where('file_size', $validated['file_size'])
            ->latest()
            ->first();
        if ($existing) {
            $existing->update(['language' => $language]);

            return $this->successResponse(['upload' => $existing->toClientArray()], 'Upload resumed');
        }

        $chunkSize = (int) config('captions.uploads.chunk_size');
        $session = UploadSession::create([
            'user_id' => $request->user()->id,
            'project_id' => $project->id,
            'original_name' => $ingest->displayName($validated['file_name'], 'video'),
            'extension' => $extension,
            'file_size' => $validated['file_size'],
            'chunk_size' => $chunkSize,
            'total_chunks' => (int) ceil($validated['file_size'] / $chunkSize),
            'received_chunks' => [],
            'language' => $language,
            'status' => UploadSession::STATUS_PENDING,
            'expires_at' => now()->addHours((int) config('captions.uploads.session_ttl_hours', 24)),
        ]);
        AppLog::info('upload.started', ['upload' => $session->uuid, 'project' => $project->uuid, 'bytes' => $session->file_size, 'chunks' => $session->total_chunks]);

        return $this->successResponse(['upload' => $session->toClientArray()], 'Upload started', 201);
    }

    public function show(UploadSession $upload): JsonResponse
    {
        $this->authorize('view', $upload);

        return $this->successResponse(['upload' => $upload->toClientArray()], 'Upload status');
    }

    public function chunk(Request $request, UploadSession $upload, int $index): JsonResponse
    {
        $this->authorize('update', $upload);

        if (! $upload->isPending()) {
            return $this->errorResponse('This upload has expired or was cancelled. Please start again.', 410);
        }
        if ($index < 0 || $index >= $upload->total_chunks) {
            return $this->errorResponse('Invalid chunk index.', 422);
        }

        $expected = $upload->expectedChunkSize($index);
        $declared = $request->header('Content-Length');
        if ($declared !== null && (int) $declared !== $expected) {
            return $this->errorResponse("Chunk {$index} must be exactly {$expected} bytes.", 422);
        }

        $dir = $upload->chunkDirectory();
        File::ensureDirectoryExists($dir, 0700);
        $partial = "{$dir}/{$index}.part.".bin2hex(random_bytes(4));

        $in = $request->getContent(true);
        $out = fopen($partial, 'wb');
        $written = stream_copy_to_stream($in, $out, $expected + 1);
        fclose($out);

        if ($written !== $expected) {
            @unlink($partial);

            return $this->errorResponse('The chunk was incomplete. Please retry.', 422);
        }
        rename($partial, "{$dir}/{$index}.chunk");

        // Serialise updates to received_chunks across parallel chunk requests.
        Cache::lock("upload:{$upload->uuid}", 10)->block(5, function () use ($upload, $index) {
            $fresh = $upload->fresh();
            $received = $fresh->receivedChunks();
            if (! in_array($index, $received, true)) {
                $received[] = $index;
                sort($received);
                $fresh->update(['received_chunks' => $received]);
            }
            $upload->setRawAttributes($fresh->getAttributes(), true);
        });

        return $this->successResponse([
            'index' => $index,
            'received' => count($upload->receivedChunks()),
            'total_chunks' => $upload->total_chunks,
        ], 'Chunk stored');
    }

    public function complete(Request $request, UploadSession $upload, MediaIngestService $ingest): JsonResponse
    {
        $this->authorize('update', $upload);

        if (! $upload->isPending()) {
            return $this->errorResponse('This upload has expired or was cancelled. Please start again.', 410);
        }
        $dir = $upload->chunkDirectory();
        $missing = array_values(array_filter(
            range(0, $upload->total_chunks - 1),
            fn (int $i) => ! is_file("{$dir}/{$i}.chunk"),
        ));
        if ($missing) {
            return $this->errorResponse('Some parts of the file are missing. Resume the upload to send them.', 409, ['missing_chunks' => $missing]);
        }

        $project = $upload->project;
        if ($project->isProcessing()) {
            return $this->errorResponse('This project is still processing. Please wait for it to finish.', 409);
        }

        $assembled = "{$dir}/assembled.{$upload->extension}";
        $out = fopen($assembled, 'wb');
        for ($i = 0; $i < $upload->total_chunks; $i++) {
            $in = fopen("{$dir}/{$i}.chunk", 'rb');
            stream_copy_to_stream($in, $out);
            fclose($in);
        }
        fclose($out);

        try {
            if (filesize($assembled) !== $upload->file_size) {
                AppLog::error('upload.size_mismatch', ['upload' => $upload->uuid, 'expected' => $upload->file_size, 'actual' => filesize($assembled)]);

                return $this->errorResponse('The uploaded file is incomplete. Please upload it again.', 422);
            }

            $media = $ingest->ingest($project, $request->user(), $assembled, $upload->original_name, $upload->language);
            $upload->update(['status' => UploadSession::STATUS_COMPLETED]);
        } finally {
            File::deleteDirectory($dir);
        }

        return $this->successResponse([
            'project' => new ProjectResource($project->fresh()),
            'media_file' => [
                'uuid' => $media->uuid,
                'original_name' => $media->original_name,
                'file_size' => $media->file_size,
            ],
            'status' => Project::STATUS_UPLOADED,
        ], 'Video uploaded successfully and queued for processing', 201);
    }

    public function destroy(UploadSession $upload): JsonResponse
    {
        $this->authorize('delete', $upload);

        File::deleteDirectory($upload->chunkDirectory());
        if ($upload->status === UploadSession::STATUS_PENDING) {
            $upload->update(['status' => UploadSession::STATUS_CANCELLED]);
        }
        AppLog::info('upload.cancelled', ['upload' => $upload->uuid]);

        return $this->successResponse(null, 'Upload cancelled');
    }
}
