<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AdminMarketingLinkController;
use App\Http\Controllers\Api\AdminMessageController;
use App\Http\Controllers\Api\AdminPaymentController;
use App\Http\Controllers\Api\AdminSignupController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AiKeyController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CaptionController;
use App\Http\Controllers\Api\CaptionTemplateController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\MediaStreamController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SubjectMaskController;
use App\Http\Controllers\Api\UploadSessionController;
use App\Http\Controllers\Api\UsageController;
use App\Http\Controllers\Api\VideoEditorAiController;
use App\Http\Controllers\Api\VideoEditorImportController;
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

// Approved creator reviews (login / sign-up screens). Public, read-only.
Route::get('/reviews', [ReviewController::class, 'index'])->middleware('throttle:60,1');

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/google', [AuthController::class, 'google'])->middleware('throttle:login');
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])->middleware('throttle:password-reset');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:password-reset');
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
    Route::get('/me/sessions', [SessionController::class, 'index']);
    Route::delete('/me/sessions', [SessionController::class, 'destroyOthers'])->middleware('throttle:login');
    Route::delete('/me/sessions/{session}', [SessionController::class, 'destroy'])->whereNumber('session');
    Route::get('/me/review', [ReviewController::class, 'mine']);
    Route::put('/me/review', [ReviewController::class, 'save'])->middleware('throttle:20,60');
    Route::delete('/me/review', [ReviewController::class, 'destroy']);

    // Admin: approve reviews before they are shown publicly.
    // Pro by bank transfer
    Route::get('/billing', [BillingController::class, 'show']);
    Route::post('/billing/payments', [BillingController::class, 'store'])->middleware('throttle:20,60');
    Route::post('/billing/payments/{payment}/slip', [BillingController::class, 'attachSlip'])->middleware('throttle:20,60');
    Route::get('/billing/payments/{payment}/slip', [BillingController::class, 'slip']);

    Route::middleware('can:manage-payments')->prefix('admin')->group(function () {
        Route::get('/payments', [AdminPaymentController::class, 'index']);
        Route::post('/payments/{payment}/approve', [AdminPaymentController::class, 'approve']);
        Route::post('/payments/{payment}/reject', [AdminPaymentController::class, 'reject']);
        Route::get('/signups', [AdminSignupController::class, 'index']);
        Route::get('/marketing-links', [AdminMarketingLinkController::class, 'index']);
        Route::post('/marketing-links', [AdminMarketingLinkController::class, 'store']);
        Route::put('/marketing-links/{link:uuid}', [AdminMarketingLinkController::class, 'update']);
        Route::delete('/marketing-links/{link:uuid}', [AdminMarketingLinkController::class, 'destroy']);
    });

    Route::middleware('can:manage-users')->prefix('admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::get('/messages', [AdminMessageController::class, 'index']);
        Route::post('/messages', [AdminMessageController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/messages/{message}/whatsapp', [AdminMessageController::class, 'whatsapp']);
        Route::get('/users/{user:uuid}', [AdminUserController::class, 'show']);
        Route::put('/users/{user:uuid}/plan', [AdminUserController::class, 'updatePlan']);
        Route::put('/users/{user:uuid}/password', [AdminUserController::class, 'resetPassword']);
        Route::post('/users/{user:uuid}/usage-reset', [AdminUserController::class, 'resetUsage']);
        Route::post('/users/{user:uuid}/sign-out', [AdminUserController::class, 'signOutEverywhere']);
        Route::delete('/users/{user:uuid}/projects', [AdminUserController::class, 'deleteProjects']);
    });

    Route::middleware('can:moderate-reviews')->prefix('admin')->group(function () {
        Route::get('/reviews', [ReviewController::class, 'adminIndex']);
        Route::patch('/reviews/{review}', [ReviewController::class, 'moderate']);
    });
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread', [NotificationController::class, 'unread']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead'])->whereUuid('id');
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy'])->whereUuid('id');

    Route::get('/settings', [SettingsController::class, 'show']);
    Route::put('/settings', [SettingsController::class, 'update']);
    Route::get('/usage', [UsageController::class, 'show']);
    Route::get('/me/ai-key', [AiKeyController::class, 'show']);
    Route::put('/me/ai-key', [AiKeyController::class, 'update'])->middleware('throttle:ai-key');
    Route::post('/me/ai-key/verify', [AiKeyController::class, 'verify'])->middleware('throttle:ai-key');
    Route::delete('/me/ai-key', [AiKeyController::class, 'destroy']);

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
        Route::post('/projects/{project}/captions/align', [CaptionController::class, 'align'])->middleware('throttle:exports');
        Route::patch('/projects/{project}/captions/{caption}', [CaptionController::class, 'update']);
        Route::delete('/projects/{project}/captions/{caption}', [CaptionController::class, 'destroy']);
    });
    Route::post('/projects/{project}/generate-captions', [CaptionController::class, 'generate'])->middleware('throttle:ai');

    // Exports (SRT/VTT/TXT/JSON immediately; MP4 rendered on the queue)
    Route::get('/projects/{project}/exports', [ExportController::class, 'index']);
    Route::get('/projects/{project}/subject-mask', [SubjectMaskController::class, 'show']);
    Route::put('/projects/{project}/subject-mask', [SubjectMaskController::class, 'update'])->middleware('throttle:exports');
    Route::post('/projects/{project}/exports', [ExportController::class, 'store'])->middleware('throttle:exports');
    Route::get('/exports/{export}', [ExportController::class, 'show']);
    Route::delete('/exports/{export}', [ExportController::class, 'destroy']);

    // Caption templates (system presets + the user's own)
    // Video editor AI tools (media stays in the browser; only audio parts or text are sent).
    Route::prefix('video-editor/ai')->middleware('throttle:editor-ai')->group(function () {
        Route::post('/transcribe', [VideoEditorAiController::class, 'transcribe']);
        Route::post('/text', [VideoEditorAiController::class, 'text']);
        Route::post('/speech', [VideoEditorAiController::class, 'speech']);
        Route::get('/voices', [VideoEditorAiController::class, 'voices']);
    });

    // Video editor: download media from a TikTok or direct link (returned as a file, not stored).
    Route::post('/video-editor/import-link', [VideoEditorImportController::class, 'link'])->middleware('throttle:uploads');

    Route::get('/caption-templates', [CaptionTemplateController::class, 'index']);
    Route::post('/caption-templates', [CaptionTemplateController::class, 'store'])->middleware('throttle:30,1');
    Route::delete('/caption-templates/{template}', [CaptionTemplateController::class, 'destroy']);
});
