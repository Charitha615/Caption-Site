<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\User;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admins: where sign-ups come from (UTM source / medium / campaign) and how many of them went Pro. */
class AdminSignupController extends Controller
{
    use ApiResponseTrait;

    /** Allowed periods in days; 0 means all time. */
    public const PERIODS = [7, 30, 90, 0];

    public function index(Request $request): JsonResponse
    {
        $days = (int) ($request->validate(['days' => ['nullable', 'integer', Rule::in(self::PERIODS)]])['days'] ?? 30);

        $paidUserIds = Payment::query()->where('status', Payment::STATUS_APPROVED)->select('user_id');

        $users = User::query()->when($days > 0, fn ($q) => $q->where('created_at', '>=', now()->subDays($days)));

        $rows = (clone $users)
            ->select('signup_source', 'signup_medium', 'signup_campaign')
            ->selectRaw('count(*) as signups')
            ->selectRaw('sum(case when id in ('.$paidUserIds->toSql().') then 1 else 0 end) as paid', $paidUserIds->getBindings())
            ->groupBy('signup_source', 'signup_medium', 'signup_campaign')
            ->orderByDesc('signups')
            ->limit(200)
            ->get()
            ->map(fn ($row) => [
                'source' => $row->signup_source,
                'medium' => $row->signup_medium,
                'campaign' => $row->signup_campaign,
                'signups' => (int) $row->signups,
                'paid' => (int) $row->paid,
            ]);

        return $this->successResponse([
            'days' => $days,
            'totals' => [
                'signups' => (clone $users)->count(),
                'paid' => (clone $users)->whereIn('id', $paidUserIds)->count(),
                'tracked' => (clone $users)->whereNotNull('signup_source')->count(),
            ],
            'sources' => $rows,
        ], 'Sign-up sources retrieved');
    }
}
