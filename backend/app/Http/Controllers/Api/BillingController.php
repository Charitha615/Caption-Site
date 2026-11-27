<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\Billing\BillingService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The signed-in user's plan and Pro payments (bank transfer). */
class BillingController extends Controller
{
    use ApiResponseTrait;

    public function __construct(protected BillingService $billing) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->successResponse([
            'plan' => [
                'key' => $user->planKey(),
                'label' => config('plans.plans.'.$user->planKey().'.label'),
                'expires_at' => $user->planKey() !== config('plans.default') ? $user->plan_expires_at?->toISOString() : null,
            ],
            'billing' => $this->billing->details($user),
            'payments' => PaymentResource::collection($user->payments()->latest()->limit(20)->get()),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'period' => ['required', Rule::in(Payment::PERIODS)],
            'slip' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,heic,pdf', 'max:'.config('billing.slip_max_kb')],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $payment = $this->billing->submit($request->user(), $validated['period'], $request->file('slip'), $validated['note'] ?? null);

        return $this->successResponse(['payment' => new PaymentResource($payment)], 'Payment sent for checking', 201);
    }

    public function attachSlip(Request $request, Payment $payment): JsonResponse
    {
        abort_unless($payment->user_id === $request->user()->id, 404);
        $request->validate(['slip' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,heic,pdf', 'max:'.config('billing.slip_max_kb')]]);

        return $this->successResponse(['payment' => new PaymentResource($this->billing->attachSlip($payment, $request->file('slip')))], 'Slip added');
    }

    /** The slip file, for its owner or an admin. */
    public function slip(Request $request, Payment $payment): StreamedResponse
    {
        $user = $request->user();
        abort_unless($payment->user_id === $user->id || $user->isAdmin(), 404);
        abort_unless($payment->slip_path && Storage::disk(BillingService::SLIP_DISK)->exists($payment->slip_path), 404);

        return Storage::disk(BillingService::SLIP_DISK)->response($payment->slip_path, "slip-{$payment->reference}", [
            'Content-Type' => $payment->slip_mime ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
