<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\Billing\BillingService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admins: check Pro payments against the bank and approve or reject them. */
class AdminPaymentController extends Controller
{
    use ApiResponseTrait;

    public function __construct(protected BillingService $billing) {}

    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::in(Payment::STATUSES)]])['status'] ?? Payment::STATUS_PENDING;
        $payments = Payment::where('status', $status)->with('user')->latest()->paginate(30);

        return $this->successResponse([
            'payments' => $payments->getCollection()->map(fn ($p) => (new PaymentResource($p))->forAdmin()),
            'counts' => Payment::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'),
            'meta' => ['current_page' => $payments->currentPage(), 'last_page' => $payments->lastPage(), 'total' => $payments->total()],
        ], 'Payments retrieved');
    }

    public function approve(Request $request, Payment $payment): JsonResponse
    {
        $note = $request->validate(['note' => ['nullable', 'string', 'max:500']])['note'] ?? null;
        $payment = $this->billing->approve($payment, $request->user(), $note);

        return $this->successResponse(['payment' => (new PaymentResource($payment->load('user')))->forAdmin()], 'Payment approved — Pro is on');
    }

    public function reject(Request $request, Payment $payment): JsonResponse
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'max:500']])['reason'];
        $payment = $this->billing->reject($payment, $request->user(), $reason);

        return $this->successResponse(['payment' => (new PaymentResource($payment->load('user')))->forAdmin()], 'Payment rejected');
    }
}
