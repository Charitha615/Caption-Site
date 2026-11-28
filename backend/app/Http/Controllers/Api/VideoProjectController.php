<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\UsageLimitExceededException;
use App\Http\Controllers\Controller;
use App\Models\VideoProject;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Video editor projects saved to the account (layout only). Each plan keeps up to
 * `plans.*.video_projects` of them; media files never come to the server.
 */
class VideoProjectController extends Controller
{
    use ApiResponseTrait;

    /** Largest layout accepted, in bytes of JSON. */
    public const MAX_DATA_BYTES = 2 * 1024 * 1024;

    public const MAX_THUMB_BYTES = 80 * 1024;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $projects = VideoProject::where('user_id', $user->id)->latest('updated_at')
            ->get(['id', 'uuid', 'name', 'aspect', 'duration', 'clip_count', 'thumb', 'created_at', 'updated_at']);

        return $this->successResponse([
            'projects' => $projects->map(fn (VideoProject $p) => $this->summary($p)),
            'limit' => $this->limit($request),
        ], 'Video projects retrieved');
    }

    public function show(Request $request, VideoProject $videoProject): JsonResponse
    {
        $this->ensureOwner($request, $videoProject);

        return $this->successResponse(['project' => $this->summary($videoProject) + ['data' => json_decode($videoProject->data, true)]], 'Video project retrieved');
    }

    public function store(Request $request): JsonResponse
    {
        $limit = $this->limit($request);
        if ($limit !== null && VideoProject::where('user_id', $request->user()->id)->count() >= $limit) {
            throw new UsageLimitExceededException("Your plan keeps up to {$limit} video projects online. Delete an old one, or upgrade to Pro.", 'video_projects');
        }
        $project = new VideoProject($this->validated($request));
        $project->user_id = $request->user()->id;
        $project->save();

        return $this->successResponse(['project' => $this->summary($project)], 'Video project saved', 201);
    }

    public function update(Request $request, VideoProject $videoProject): JsonResponse
    {
        $this->ensureOwner($request, $videoProject);
        $videoProject->fill($this->validated($request))->save();

        return $this->successResponse(['project' => $this->summary($videoProject)], 'Video project saved');
    }

    public function destroy(Request $request, VideoProject $videoProject): JsonResponse
    {
        $this->ensureOwner($request, $videoProject);
        $videoProject->delete();

        return $this->successResponse(null, 'Video project deleted');
    }

    /** @return array{name: string, aspect: string, duration: float, clip_count: int, data: string, thumb: ?string} */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'aspect' => ['required', Rule::in(['16:9', '9:16', '1:1', '4:5'])],
            'data' => ['required', 'array'],
            'data.version' => ['required', 'integer', Rule::in([1])],
            'data.tracks' => ['present', 'array'],
            'data.clips' => ['present', 'array'],
            'data.media' => ['present', 'array'],
            'thumb' => ['nullable', 'string', 'max:'.self::MAX_THUMB_BYTES, 'regex:/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/'],
        ]);
        $json = (string) json_encode($data['data']);
        if (strlen($json) > self::MAX_DATA_BYTES) {
            throw ValidationException::withMessages(['data' => 'This project is too big to save online. Download a project file instead.']);
        }
        $clips = $data['data']['clips'];
        $end = collect($clips)->map(fn ($c) => is_array($c) ? (float) ($c['start'] ?? 0) + (float) ($c['duration'] ?? 0) : 0)->max() ?? 0;

        return [
            'name' => trim($data['name']) ?: 'Untitled video',
            'aspect' => $data['aspect'],
            'duration' => round((float) $end, 2),
            'clip_count' => count($clips),
            'data' => $json,
            'thumb' => $data['thumb'] ?? null,
        ];
    }

    private function ensureOwner(Request $request, VideoProject $project): void
    {
        abort_unless($project->user_id === $request->user()->id, 404);
    }

    private function limit(Request $request): ?int
    {
        $limit = config('plans.plans.'.$request->user()->planKey().'.video_projects');

        return $limit === null ? null : (int) $limit;
    }

    /** @return array{uuid: string, name: string, aspect: string, duration: float, clip_count: int, thumb: ?string, created_at: ?string, updated_at: ?string} */
    private function summary(VideoProject $p): array
    {
        return [
            'uuid' => $p->uuid,
            'name' => $p->name,
            'aspect' => $p->aspect,
            'duration' => (float) $p->duration,
            'clip_count' => (int) $p->clip_count,
            'thumb' => $p->thumb,
            'created_at' => $p->created_at?->toISOString(),
            'updated_at' => $p->updated_at?->toISOString(),
        ];
    }
}
