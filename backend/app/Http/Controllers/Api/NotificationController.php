<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/** The user's notification bell: automatic notices and messages from the admin. */
class NotificationController extends Controller
{
    use ApiResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $page = $user->notifications()->latest()->paginate(min(50, max(5, (int) $request->query('per_page', 20))));

        return $this->successResponse([
            'notifications' => $page->getCollection()->map(fn (DatabaseNotification $n) => $this->present($n)),
            'unread' => $user->unreadNotifications()->count(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ], 'Notifications retrieved');
    }

    /** Just the unread count, for the bell to check every so often. */
    public function unread(Request $request): JsonResponse
    {
        return $this->successResponse(['unread' => $request->user()->unreadNotifications()->count()], 'Unread count');
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return $this->successResponse(['notification' => $this->present($notification)], 'Marked as read');
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return $this->successResponse(['unread' => 0], 'All marked as read');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->whereKey($id)->firstOrFail()->delete();

        return $this->successResponse(null, 'Notification removed');
    }

    /** @return array{id: string, kind: string, title: string, body: string, link: ?string, category: ?string, button_label: ?string, read: bool, created_at: ?string} */
    private function present(DatabaseNotification $n): array
    {
        $data = $n->data;

        return [
            'id' => $n->id,
            'kind' => (string) ($data['kind'] ?? 'system'),
            'title' => (string) ($data['title'] ?? 'Notification'),
            'body' => (string) ($data['body'] ?? ''),
            'link' => isset($data['link']) && is_string($data['link']) ? $data['link'] : null,
            'category' => isset($data['category']) && is_string($data['category']) ? $data['category'] : null,
            'button_label' => isset($data['button_label']) && is_string($data['button_label']) ? $data['button_label'] : null,
            'read' => $n->read_at !== null,
            'created_at' => $n->created_at?->toISOString(),
        ];
    }
}
