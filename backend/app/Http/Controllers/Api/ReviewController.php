<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use App\Support\AppLog;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReviewController extends Controller
{
    use ApiResponseTrait;

    private const PUBLIC_LIMIT = 12;

    /**
     * Approved reviews for the public screens (login / sign-up). Best ratings first, newest next.
     */
    public function index(): JsonResponse
    {
        $reviews = Review::approved()->with('user:id,name,avatar_url')
            ->orderByDesc('rating')->orderByDesc('approved_at')
            ->limit(self::PUBLIC_LIMIT)->get();

        return $this->successResponse(['reviews' => ReviewResource::collection($reviews)], 'Reviews retrieved');
    }

    /** The signed-in user's own review (or null). */
    public function mine(Request $request): JsonResponse
    {
        $review = $request->user()->review()->with('user:id,name,avatar_url')->first();

        return $this->successResponse(['review' => $review ? (new ReviewResource($review))->withStatus() : null], 'Your review');
    }

    /** Create or update the user's review. Any change needs approval again. */
    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'body' => ['required', 'string', 'min:10', 'max:300'],
            'role' => ['nullable', 'string', 'max:80'],
        ]);
        $data['body'] = trim(preg_replace('/\s+/u', ' ', $data['body']) ?? $data['body']);
        $data['role'] = filled($data['role'] ?? null) ? trim($data['role']) : null;

        $review = $request->user()->review()->firstOrNew([], ['uuid' => (string) Str::uuid()]);
        $review->fill($data);
        if (! $review->exists || $review->isDirty(['rating', 'body', 'role'])) {
            $review->forceFill(['status' => Review::STATUS_PENDING, 'approved_at' => null]);
        }
        $created = ! $review->exists;
        $review->save();
        AppLog::info('review.saved', ['review' => $review->uuid, 'user' => $request->user()->uuid, 'rating' => $review->rating]);

        return $this->successResponse(
            ['review' => (new ReviewResource($review->load('user:id,name,avatar_url')))->withStatus()],
            'Thanks! Your review will appear once it is approved.',
            $created ? 201 : 200,
        );
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->user()->review()->delete();

        return $this->successResponse(null, 'Review deleted');
    }

    /* ---------------------------------------------------------------- admin */

    public function adminIndex(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::in(Review::STATUSES)]])['status'] ?? Review::STATUS_PENDING;
        $reviews = Review::where('status', $status)->with('user:id,name,avatar_url')->latest('updated_at')->paginate(30);

        return $this->successResponse([
            'reviews' => $reviews->getCollection()->map(fn ($r) => (new ReviewResource($r))->withStatus()),
            'counts' => Review::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'),
            'meta' => ['current_page' => $reviews->currentPage(), 'last_page' => $reviews->lastPage(), 'total' => $reviews->total()],
        ], 'Reviews retrieved');
    }

    public function moderate(Request $request, Review $review): JsonResponse
    {
        $status = $request->validate(['status' => ['required', Rule::in([Review::STATUS_APPROVED, Review::STATUS_REJECTED])]])['status'];
        $review->forceFill(['status' => $status, 'approved_at' => $status === Review::STATUS_APPROVED ? now() : null])->save();
        AppLog::info('review.moderated', ['review' => $review->uuid, 'status' => $status, 'by' => $request->user()->uuid]);

        return $this->successResponse(['review' => (new ReviewResource($review->load('user:id,name,avatar_url')))->withStatus()], 'Review '.$status);
    }
}
