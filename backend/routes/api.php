<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\IngestionController;
use App\Http\Controllers\Api\V1\MappingReviewController;
use App\Http\Controllers\Api\V1\SourceController;
use App\Http\Controllers\Api\V1\VocabularyController;
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

        // Vocabulary
        Route::get('/vocabulary/search', [VocabularyController::class, 'search']);
        Route::get('/vocabulary/concepts/{id}', [VocabularyController::class, 'show']);
        Route::get('/vocabulary/concepts/{id}/relationships', [VocabularyController::class, 'relationships']);
        Route::get('/vocabulary/concepts/{id}/ancestors', [VocabularyController::class, 'ancestors']);
        Route::post('/vocabulary/semantic-search', [VocabularyController::class, 'semanticSearch']);

        // Ingestion
        Route::post('/ingestion/upload', [IngestionController::class, 'upload']);
        Route::get('/ingestion/jobs', [IngestionController::class, 'index']);
        Route::get('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'show']);
        Route::get('/ingestion/jobs/{ingestionJob}/profile', [IngestionController::class, 'profile']);
        Route::delete('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'destroy']);
        Route::post('/ingestion/jobs/{ingestionJob}/retry', [IngestionController::class, 'retry']);

        // Mapping Review
        Route::get('/ingestion/jobs/{ingestionJob}/mappings', [MappingReviewController::class, 'index']);
        Route::get('/ingestion/jobs/{ingestionJob}/mappings/stats', [MappingReviewController::class, 'stats']);
        Route::post('/ingestion/jobs/{ingestionJob}/mappings/{conceptMapping}/review', [MappingReviewController::class, 'review']);
        Route::post('/ingestion/jobs/{ingestionJob}/mappings/batch-review', [MappingReviewController::class, 'batchReview']);
        Route::get('/ingestion/jobs/{ingestionJob}/mappings/{conceptMapping}/candidates', [MappingReviewController::class, 'candidates']);

        // Schema Mapping
        Route::post('/ingestion/jobs/{ingestionJob}/schema-mapping/suggest', [IngestionController::class, 'suggestSchemaMapping']);
        Route::get('/ingestion/jobs/{ingestionJob}/schema-mapping', [IngestionController::class, 'getSchemaMapping']);
        Route::put('/ingestion/jobs/{ingestionJob}/schema-mapping', [IngestionController::class, 'updateSchemaMapping']);
        Route::post('/ingestion/jobs/{ingestionJob}/schema-mapping/confirm', [IngestionController::class, 'confirmSchemaMapping']);

        // Validation
        Route::get('/ingestion/jobs/{ingestionJob}/validation', [IngestionController::class, 'validation']);
        Route::get('/ingestion/jobs/{ingestionJob}/validation/summary', [IngestionController::class, 'validationSummary']);

        // Stubs for future phases
        Route::get('/cohort-definitions', fn () => response()->json(['message' => 'Not yet implemented'], 501));
        Route::get('/concept-sets', fn () => response()->json(['message' => 'Not yet implemented'], 501));
    });
});
