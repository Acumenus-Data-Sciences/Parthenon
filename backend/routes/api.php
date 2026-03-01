<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\SourceController;
use Illuminate\Support\Facades\Route;

// Public health check
Route::get('/health', [HealthController::class, 'index']);

// API v1
Route::prefix('v1')->group(function () {
    // Auth (public)
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Sources
        Route::apiResource('sources', SourceController::class);

        // Stubs for future phases
        Route::get('/vocabulary/search', fn () => response()->json(['message' => 'Not yet implemented'], 501));
        Route::get('/cohort-definitions', fn () => response()->json(['message' => 'Not yet implemented'], 501));
        Route::get('/concept-sets', fn () => response()->json(['message' => 'Not yet implemented'], 501));
    });
});
