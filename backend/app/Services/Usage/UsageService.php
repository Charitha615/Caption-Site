<?php

namespace App\Services\Usage;

use App\Exceptions\UsageLimitExceededException;
use App\Models\Export;
use App\Models\MediaFile;
use App\Models\Project;
use App\Models\UsageRecord;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Usage ledger + plan limits (AI cost control).
 *
 * Every billable action is appended to usage_records. Limits come from
 * config/plans.php for the user's plan. Summaries are cached briefly and
 * invalidated on every write, so checks stay cheap under load.
 */
class UsageService
{
    private const CACHE_TTL = 300;

    /** @return array<string, int|string|null> */
    public function limits(User $user): array
    {
        return config('plans.plans.'.$user->planKey());
    }

    public function record(User|int $user, string $action, float $quantity, string $unit, ?Project $project = null, array $metadata = []): UsageRecord
    {
        $userId = $user instanceof User ? $user->id : $user;
        $record = UsageRecord::create([
            'user_id' => $userId,
            'project_id' => $project?->id,
            'action' => $action,
            'quantity' => $quantity,
            'unit' => $unit,
            'metadata' => $metadata ?: null,
        ]);
        $this->forget($userId);

        return $record;
    }

    /**
     * @return array{
     *     plan: array{key: string, label: string},
     *     period: array{start: string, end: string},
     *     caption_minutes: array{used: float, limit: ?int},
     *     ai_requests_today: array{used: int, limit: ?int},
     *     exports: array{used: int, limit: ?int},
     *     renders: array{used: int, limit: ?int},
     *     storage_mb: array{used: float, limit: ?int},
     *     max_upload_mb: ?int,
     *     max_video_minutes: ?int
     * }
     */
    public function summary(User $user): array
    {
        return Cache::remember($this->cacheKey($user->id), self::CACHE_TTL, function () use ($user) {
            $limits = $this->limits($user);
            $monthStart = Carbon::now()->startOfMonth();

            $monthly = UsageRecord::query()
                ->where('user_id', $user->id)
                ->where('created_at', '>=', $monthStart)
                ->selectRaw('action, SUM(quantity) as total, COUNT(*) as events')
                ->groupBy('action')
                ->get()
                ->keyBy('action');

            $aiToday = UsageRecord::query()
                ->where('user_id', $user->id)
                ->where('action', UsageRecord::ACTION_AI_REQUEST)
                ->where('created_at', '>=', Carbon::now()->startOfDay())
                ->count();

            return [
                'plan' => ['key' => $user->planKey(), 'label' => $limits['label']],
                'period' => ['start' => $monthStart->toDateString(), 'end' => $monthStart->copy()->endOfMonth()->toDateString()],
                'caption_minutes' => [
                    'used' => round(((float) ($monthly[UsageRecord::ACTION_CAPTION_GENERATION]->total ?? 0)) / 60, 1),
                    'limit' => $limits['caption_minutes_per_month'],
                ],
                'ai_requests_today' => ['used' => $aiToday, 'limit' => $limits['ai_requests_per_day']],
                'exports' => ['used' => (int) ($monthly[UsageRecord::ACTION_EXPORT]->events ?? 0), 'limit' => $limits['exports_per_month']],
                'renders' => ['used' => (int) ($monthly[UsageRecord::ACTION_VIDEO_RENDER]->events ?? 0), 'limit' => $limits['renders_per_month']],
                'storage_mb' => ['used' => round($this->storageBytes($user) / 1048576, 1), 'limit' => $limits['storage_mb']],
                'max_upload_mb' => $limits['max_upload_mb'],
                'max_video_minutes' => $limits['max_video_minutes'],
            ];
        });
    }

    /** Bytes currently stored for the user (source videos + exported files). */
    public function storageBytes(User $user): int
    {
        $media = (int) MediaFile::query()
            ->whereHas('project', fn ($q) => $q->where('user_id', $user->id))
            ->sum('file_size');
        $exports = (int) Export::query()->where('user_id', $user->id)->sum('file_size');

        return $media + $exports;
    }

    public function ensureCanUpload(User $user, int $bytes): void
    {
        $limits = $this->limits($user);
        if ($limits['max_upload_mb'] !== null && $bytes > $limits['max_upload_mb'] * 1048576) {
            throw new UsageLimitExceededException("Videos on your plan can be up to {$limits['max_upload_mb']} MB.", 'max_upload_mb');
        }
        if ($limits['storage_mb'] !== null && $this->storageBytes($user) + $bytes > $limits['storage_mb'] * 1048576) {
            throw new UsageLimitExceededException('You are out of storage. Delete old projects or exports to free up space.', 'storage_mb');
        }
        $this->ensureCaptionMinutesRemain($user, 0);
    }

    /** @param float $seconds media duration about to be captioned (0 when not known yet) */
    public function ensureCaptionMinutesRemain(User $user, float $seconds): void
    {
        $limits = $this->limits($user);
        if ($limits['max_video_minutes'] !== null && $seconds > $limits['max_video_minutes'] * 60) {
            throw new UsageLimitExceededException("Videos on your plan can be up to {$limits['max_video_minutes']} minutes long.", 'max_video_minutes');
        }

        $limit = $limits['caption_minutes_per_month'];
        if ($limit === null) {
            return;
        }
        $used = $this->summary($user)['caption_minutes']['used'];
        if ($used >= $limit || $used + $seconds / 60 > $limit) {
            throw new UsageLimitExceededException("This would exceed your {$limit} caption minutes for this month.", 'caption_minutes_per_month');
        }
    }

    public function ensureCanRequestAI(User $user): void
    {
        $summary = $this->summary($user)['ai_requests_today'];
        if ($summary['limit'] !== null && $summary['used'] >= $summary['limit']) {
            throw new UsageLimitExceededException('You have reached today\'s AI captioning limit. Please try again tomorrow.', 'ai_requests_per_day');
        }
    }

    public function ensureCanExport(User $user, string $type): void
    {
        $summary = $this->summary($user);
        $key = $type === 'mp4' ? 'renders' : 'exports';
        if ($summary[$key]['limit'] !== null && $summary[$key]['used'] >= $summary[$key]['limit']) {
            throw new UsageLimitExceededException(
                $type === 'mp4' ? 'You have used all video renders for this month.' : 'You have used all exports for this month.',
                $key === 'renders' ? 'renders_per_month' : 'exports_per_month',
            );
        }
    }

    public function maxConcurrentRenders(User $user): int
    {
        return (int) ($this->limits($user)['concurrent_renders'] ?? 2);
    }

    public function forget(int $userId): void
    {
        Cache::forget($this->cacheKey($userId));
    }

    private function cacheKey(int $userId): string
    {
        return "usage:summary:{$userId}:".Carbon::now()->format('Y-m-d');
    }
}
