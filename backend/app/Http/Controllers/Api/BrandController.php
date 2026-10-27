<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Brand\BrandService;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class BrandController extends Controller
{
    use ApiResponseTrait;

    public function __construct(
        protected BrandService $brandService,
    ) {}

    /**
     * Return centralized brand configuration and styling tokens.
     */
    public function show(): JsonResponse
    {
        return $this->successResponse($this->brandService->getBrandConfig(), 'Brand configuration retrieved');
    }
}
