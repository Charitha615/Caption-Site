<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CaptionController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\VideoUploadController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/
Route::get('/brand', [BrandController::class, 'show']);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

/*
|--------------------------------------------------------------------------
| Protected Sanctum Routes
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->group(function () {
    // Current user and session
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Dashboard metrics
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Projects CRUD
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::patch('/projects/{project}', [ProjectController::class, 'update']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

    // Project Status & Video Upload
    Route::get('/projects/{project}/status', [ProjectController::class, 'status']);
    Route::post('/projects/{project}/upload', [VideoUploadController::class, 'upload']);

    // Caption Management & AI Generation
    Route::get('/projects/{project}/captions', [CaptionController::class, 'index']);
    Route::post('/projects/{project}/captions', [CaptionController::class, 'store']);
    Route::put('/projects/{project}/captions/sync', [CaptionController::class, 'sync']);
    Route::patch('/projects/{project}/captions/{caption}', [CaptionController::class, 'update']);
    Route::delete('/projects/{project}/captions/{caption}', [CaptionController::class, 'destroy']);
    Route::post('/projects/{project}/generate-captions', [CaptionController::class, 'generate']);
});
