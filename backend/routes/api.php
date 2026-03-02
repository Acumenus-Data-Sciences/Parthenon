<?php

use App\Http\Controllers\Api\V1\AbbyAiController;
use App\Http\Controllers\Api\V1\AchillesController;
use App\Http\Controllers\Api\V1\Admin\AuthProviderController;
use App\Http\Controllers\Api\V1\Admin\RoleController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CareGapController;
use App\Http\Controllers\Api\V1\CharacterizationController;
use App\Http\Controllers\Api\V1\CohortDefinitionController;
use App\Http\Controllers\Api\V1\ConceptSetController;
use App\Http\Controllers\Api\V1\DataQualityController;
use App\Http\Controllers\Api\V1\EstimationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\IncidenceRateController;
use App\Http\Controllers\Api\V1\IngestionController;
use App\Http\Controllers\Api\V1\MappingReviewController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\PathwayController;
use App\Http\Controllers\Api\V1\PatientProfileController;
use App\Http\Controllers\Api\V1\PredictionController;
use App\Http\Controllers\Api\V1\SourceController;
use App\Http\Controllers\Api\V1\StudyController;
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

        // Achilles (Data Characterization)
        Route::prefix('sources/{source}/achilles')->group(function () {
            Route::get('/record-counts', [AchillesController::class, 'recordCounts']);
            Route::get('/demographics', [AchillesController::class, 'demographics']);
            Route::get('/observation-periods', [AchillesController::class, 'observationPeriods']);
            Route::get('/domains/{domain}', [AchillesController::class, 'domainSummary']);
            Route::get('/domains/{domain}/concepts/{conceptId}', [AchillesController::class, 'conceptDrilldown']);
            Route::get('/temporal-trends', [AchillesController::class, 'temporalTrends']);
            Route::get('/analyses', [AchillesController::class, 'analyses']);
            Route::get('/performance', [AchillesController::class, 'performance']);
            Route::get('/distributions/{analysisId}', [AchillesController::class, 'distribution']);
        });

        // Data Quality Dashboard
        Route::prefix('sources/{source}/dqd')->group(function () {
            Route::get('/runs', [DataQualityController::class, 'runs']);
            Route::get('/runs/{runId}', [DataQualityController::class, 'showRun']);
            Route::get('/runs/{runId}/results', [DataQualityController::class, 'results']);
            Route::get('/runs/{runId}/summary', [DataQualityController::class, 'summary']);
            Route::get('/runs/{runId}/tables/{table}', [DataQualityController::class, 'tableResults']);
            Route::post('/run', [DataQualityController::class, 'dispatch']);
            Route::get('/latest', [DataQualityController::class, 'latest']);
            Route::delete('/runs/{runId}', [DataQualityController::class, 'destroyRun']);
        });

        // Concept Sets
        Route::apiResource('concept-sets', ConceptSetController::class);
        Route::get('/concept-sets/{concept_set}/resolve', [ConceptSetController::class, 'resolve']);
        Route::post('/concept-sets/{concept_set}/items', [ConceptSetController::class, 'addItem']);
        Route::put('/concept-sets/{concept_set}/items/{item}', [ConceptSetController::class, 'updateItem']);
        Route::delete('/concept-sets/{concept_set}/items/{item}', [ConceptSetController::class, 'removeItem']);

        // Enhanced Vocabulary
        Route::get('/vocabulary/concepts/{id}/descendants', [VocabularyController::class, 'descendants']);
        Route::get('/vocabulary/concepts/{id}/hierarchy', [VocabularyController::class, 'hierarchy']);
        Route::get('/vocabulary/domains', [VocabularyController::class, 'domains']);
        Route::get('/vocabulary/vocabularies-list', [VocabularyController::class, 'vocabularies']);

        // Cohort Definitions
        Route::apiResource('cohort-definitions', CohortDefinitionController::class);
        Route::post('/cohort-definitions/{cohortDefinition}/generate', [CohortDefinitionController::class, 'generate']);
        Route::get('/cohort-definitions/{cohortDefinition}/generations', [CohortDefinitionController::class, 'generations']);
        Route::get('/cohort-definitions/{cohortDefinition}/generations/{generation}', [CohortDefinitionController::class, 'showGeneration']);
        Route::get('/cohort-definitions/{cohortDefinition}/sql', [CohortDefinitionController::class, 'previewSql']);
        Route::post('/cohort-definitions/{cohortDefinition}/copy', [CohortDefinitionController::class, 'copy']);

        // Characterizations
        Route::apiResource('characterizations', CharacterizationController::class);
        Route::post('characterizations/{characterization}/execute', [CharacterizationController::class, 'execute']);
        Route::get('characterizations/{characterization}/executions', [CharacterizationController::class, 'executions']);
        Route::get('characterizations/{characterization}/executions/{execution}', [CharacterizationController::class, 'showExecution']);

        // Incidence Rates
        Route::apiResource('incidence-rates', IncidenceRateController::class);
        Route::post('incidence-rates/{incidenceRate}/execute', [IncidenceRateController::class, 'execute']);
        Route::get('incidence-rates/{incidenceRate}/executions', [IncidenceRateController::class, 'executions']);
        Route::get('incidence-rates/{incidenceRate}/executions/{execution}', [IncidenceRateController::class, 'showExecution']);

        // Pathways
        Route::apiResource('pathways', PathwayController::class);
        Route::post('pathways/{pathway}/execute', [PathwayController::class, 'execute']);
        Route::get('pathways/{pathway}/executions', [PathwayController::class, 'executions']);
        Route::get('pathways/{pathway}/executions/{execution}', [PathwayController::class, 'showExecution']);

        // Estimation
        Route::apiResource('estimations', EstimationController::class);
        Route::post('estimations/{estimation}/execute', [EstimationController::class, 'execute']);
        Route::get('estimations/{estimation}/executions', [EstimationController::class, 'executions']);
        Route::get('estimations/{estimation}/executions/{execution}', [EstimationController::class, 'showExecution']);

        // Prediction
        Route::apiResource('predictions', PredictionController::class);
        Route::post('predictions/{prediction}/execute', [PredictionController::class, 'execute']);
        Route::get('predictions/{prediction}/executions', [PredictionController::class, 'executions']);
        Route::get('predictions/{prediction}/executions/{execution}', [PredictionController::class, 'showExecution']);

        // Studies
        Route::apiResource('studies', StudyController::class);
        Route::post('studies/{study}/execute', [StudyController::class, 'executeAll']);
        Route::get('studies/{study}/progress', [StudyController::class, 'progress']);
        Route::get('studies/{study}/analyses', [StudyController::class, 'analyses']);
        Route::post('studies/{study}/analyses', [StudyController::class, 'addAnalysis']);
        Route::delete('studies/{study}/analyses/{studyAnalysis}', [StudyController::class, 'removeAnalysis']);

        // Patient Profiles
        Route::get('sources/{source}/profiles/{personId}', [PatientProfileController::class, 'show']);
        Route::get('sources/{source}/cohorts/{cohortDefinitionId}/members', [PatientProfileController::class, 'members']);

        // Notification Preferences
        Route::get('user/notification-preferences', [NotificationPreferenceController::class, 'show']);
        Route::put('user/notification-preferences', [NotificationPreferenceController::class, 'update']);

        // Care Bundles & Care Gaps
        Route::prefix('care-bundles')->group(function () {
            Route::get('/overlap-rules', [CareGapController::class, 'overlapRules']);
            Route::get('/population-summary', [CareGapController::class, 'populationSummary']);

            Route::get('/', [CareGapController::class, 'index']);
            Route::post('/', [CareGapController::class, 'store']);
            Route::get('/{bundle}', [CareGapController::class, 'show']);
            Route::put('/{bundle}', [CareGapController::class, 'update']);
            Route::delete('/{bundle}', [CareGapController::class, 'destroy']);

            Route::get('/{bundle}/measures', [CareGapController::class, 'measures']);
            Route::post('/{bundle}/measures', [CareGapController::class, 'addMeasure']);
            Route::delete('/{bundle}/measures/{measure}', [CareGapController::class, 'removeMeasure']);

            Route::post('/{bundle}/evaluate', [CareGapController::class, 'evaluate']);
            Route::get('/{bundle}/evaluations', [CareGapController::class, 'evaluations']);
            Route::get('/{bundle}/evaluations/{evaluation}', [CareGapController::class, 'showEvaluation']);
        });

        // Abby AI
        Route::prefix('abby')->group(function () {
            Route::post('build-cohort', [AbbyAiController::class, 'buildCohort']);
            Route::post('suggest-criteria', [AbbyAiController::class, 'suggestCriteria']);
            Route::post('explain', [AbbyAiController::class, 'explain']);
            Route::post('refine', [AbbyAiController::class, 'refine']);
        });

        // ── Admin panel (requires admin or super-admin role) ───────────────
        Route::prefix('admin')->middleware('role:admin|super-admin')->group(function () {

            // ── User management ───────────────────────────────────────────
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/roles', [UserController::class, 'roles']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::put('/users/{user}', [UserController::class, 'update']);
            Route::delete('/users/{user}', [UserController::class, 'destroy']);
            Route::put('/users/{user}/roles', [UserController::class, 'syncRoles']);

            // ── Role & permission management (super-admin only) ────────────
            Route::middleware('role:super-admin')->group(function () {
                Route::get('/roles', [RoleController::class, 'index']);
                Route::post('/roles', [RoleController::class, 'store']);
                Route::get('/roles/permissions', [RoleController::class, 'permissions']);
                Route::get('/roles/{role}', [RoleController::class, 'show']);
                Route::put('/roles/{role}', [RoleController::class, 'update']);
                Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
            });

            // ── Auth provider configuration (super-admin only) ────────────
            Route::middleware('role:super-admin')->prefix('auth-providers')->group(function () {
                Route::get('/', [AuthProviderController::class, 'index']);
                Route::get('/{providerType}', [AuthProviderController::class, 'show']);
                Route::put('/{providerType}', [AuthProviderController::class, 'update']);
                Route::post('/{providerType}/enable', [AuthProviderController::class, 'enable']);
                Route::post('/{providerType}/disable', [AuthProviderController::class, 'disable']);
                Route::post('/{providerType}/test', [AuthProviderController::class, 'test']);
            });
        });
    });
});
