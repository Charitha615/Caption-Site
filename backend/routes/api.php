<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CaptionController;
use App\Http\Controllers\Api\CaptionTemplateController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\MediaStreamController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UploadSessionController;
use App\Http\Controllers\Api\UsageController;
use App\Http\Controllers\Api\VideoUploadController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes
|--------------------------------------------------------------------------
| Rate limiters are defined in AppServiceProvider::configureRateLimiting().
*/
Route::get('/brand', [BrandController::class, 'show'])->middleware('throttle:api');

// Signed, expiring URLs issued only to the owner (see ExportResource / ProjectResource).
// They let <a download>, <video> and <img> work without a bearer token.
Route::middleware('signed')->group(function () {
    Route::get('/exports/{export}/download', [ExportController::class, 'download'])
        ->middleware('throttle:60,1')
        ->name('exports.download');
    Route::get('/media/{media}/stream', [MediaStreamController::class, 'stream'])
        ->middleware('throttle:media')
        ->name('media.stream');
    Route::get('/projects/{project}/thumbnail', [MediaStreamController::class, 'thumbnail'])
        ->middleware('throttle:media')
        ->name('projects.thumbnail');
});

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
});

/*
|--------------------------------------------------------------------------
| Authenticated routes (Sanctum bearer tokens)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    // Account
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AccountController::class, 'update']);
    Route::put('/me/password', [AccountController::class, 'updatePassword'])->middleware('throttle:login');
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::get('/usage', [UsageController::class, 'show']);

    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Projects
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::patch('/projects/{project}', [ProjectController::class, 'update']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);
    Route::get('/projects/{project}/status', [ProjectController::class, 'status'])->middleware('throttle:polling');

    // Uploads: single request (small files) and chunked/resumable (web app)
    Route::post('/projects/{project}/upload', [VideoUploadController::class, 'upload'])->middleware('throttle:uploads');
    Route::post('/projects/{project}/uploads', [UploadSessionController::class, 'store'])->middleware('throttle:uploads');
    Route::get('/uploads/{upload}', [UploadSessionController::class, 'show']);
    Route::put('/uploads/{upload}/chunks/{index}', [UploadSessionController::class, 'chunk'])
        ->whereNumber('index')
        ->withoutMiddleware('throttle:api')
        ->middleware('throttle:upload-chunks');
    Route::post('/uploads/{upload}/complete', [UploadSessionController::class, 'complete']);
    Route::delete('/uploads/{upload}', [UploadSessionController::class, 'destroy']);

    // Captions — scoped bindings: a caption must belong to the project in the URL.
    Route::scopeBindings()->group(function () {
        Route::get('/projects/{project}/captions', [CaptionController::class, 'index']);
        Route::post('/projects/{project}/captions', [CaptionController::class, 'store']);
        Route::put('/projects/{project}/captions/sync', [CaptionController::class, 'sync'])->middleware('throttle:autosave');
        Route::patch('/projects/{project}/captions/{caption}', [CaptionController::class, 'update']);
        Route::delete('/projects/{project}/captions/{caption}', [CaptionController::class, 'destroy']);
    });
    Route::post('/projects/{project}/generate-captions', [CaptionController::class, 'generate'])->middleware('throttle:ai');

    // Exports (SRT/VTT/TXT/JSON immediately; MP4 rendered on the queue)
    Route::get('/projects/{project}/exports', [ExportController::class, 'index']);
    Route::post('/projects/{project}/exports', [ExportController::class, 'store'])->middleware('throttle:exports');
    Route::get('/exports/{export}', [ExportController::class, 'show']);
    Route::delete('/exports/{export}', [ExportController::class, 'destroy']);

    // Caption templates (system presets + the user's own)
    Route::get('/caption-templates', [CaptionTemplateController::class, 'index']);
    Route::post('/caption-templates', [CaptionTemplateController::class, 'store'])->middleware('throttle:30,1');
    Route::delete('/caption-templates/{template}', [CaptionTemplateController::class, 'destroy']);
});
