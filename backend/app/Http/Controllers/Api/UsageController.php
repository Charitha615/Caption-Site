<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Usage\UsageService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UsageController extends Controller
{
    use ApiResponseTrait;

    /** Current-period usage against the user's plan limits. */
    public function show(Request $request, UsageService $usage): JsonResponse
    {
        return $this->successResponse(['usage' => $usage->summary($request->user())], 'Usage retrieved');
    }
}
