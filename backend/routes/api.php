<?php

use App\Http\Controllers\Api\V1\AbbyAiController;
use App\Http\Controllers\Api\V1\AbbyConversationController;
use App\Http\Controllers\Api\V1\AbbyProfileController;
use App\Http\Controllers\Api\V1\AchillesController;
use App\Http\Controllers\Api\V1\Admin\AiProviderController;
use App\Http\Controllers\Api\V1\Admin\AppSettingsController;
use App\Http\Controllers\Api\V1\Admin\AtlasMigrationController;
use App\Http\Controllers\Api\V1\Admin\AuthProviderController;
use App\Http\Controllers\Api\V1\Admin\ChromaStudioController;
use App\Http\Controllers\Api\V1\Admin\FhirConnectionController;
use App\Http\Controllers\Api\V1\Admin\LiveKitConfigController;
use App\Http\Controllers\Api\V1\Admin\PacsConnectionController;
use App\Http\Controllers\Api\V1\Admin\RoleController;
use App\Http\Controllers\Api\V1\Admin\SolrAdminController;
use App\Http\Controllers\Api\V1\Admin\SystemHealthController;
use App\Http\Controllers\Api\V1\Admin\UserAuditController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\Admin\VocabularyController as AdminVocabularyController;
use App\Http\Controllers\Api\V1\Admin\WebApiRegistryController;
use App\Http\Controllers\Api\V1\AnalysisStatsController;
use App\Http\Controllers\Api\V1\ArachneController;
use App\Http\Controllers\Api\V1\AresController;
use App\Http\Controllers\Api\V1\AriadneController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CareGapController;
use App\Http\Controllers\Api\V1\CharacterizationController;
use App\Http\Controllers\Api\V1\CirceController;
use App\Http\Controllers\Api\V1\ClaimsSearchController;
use App\Http\Controllers\Api\V1\ClinicalCoherenceController;
use App\Http\Controllers\Api\V1\CohortDefinitionController;
use App\Http\Controllers\Api\V1\CohortDiagnosticsController;
use App\Http\Controllers\Api\V1\Commons\ActivityController;
use App\Http\Controllers\Api\V1\Commons\AnnouncementController;
use App\Http\Controllers\Api\V1\Commons\AttachmentController;
use App\Http\Controllers\Api\V1\Commons\CallController;
use App\Http\Controllers\Api\V1\Commons\ChannelController;
use App\Http\Controllers\Api\V1\Commons\DirectMessageController;
use App\Http\Controllers\Api\V1\Commons\MemberController;
use App\Http\Controllers\Api\V1\Commons\MessageController;
use App\Http\Controllers\Api\V1\Commons\NotificationController;
use App\Http\Controllers\Api\V1\Commons\ObjectReferenceController;
use App\Http\Controllers\Api\V1\Commons\PinController;
use App\Http\Controllers\Api\V1\Commons\ReactionController;
use App\Http\Controllers\Api\V1\Commons\ReviewRequestController;
use App\Http\Controllers\Api\V1\Commons\WikiController;
use App\Http\Controllers\Api\V1\ConceptExplorerController;
use App\Http\Controllers\Api\V1\ConceptSetController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DataInterrogationController;
use App\Http\Controllers\Api\V1\DataQualityController;
use App\Http\Controllers\Api\V1\EstimationController;
use App\Http\Controllers\Api\V1\EtlFieldMappingController;
use App\Http\Controllers\Api\V1\EtlProjectController;
use App\Http\Controllers\Api\V1\EvidencePinController;
use App\Http\Controllers\Api\V1\EvidenceSynthesisController;
use App\Http\Controllers\Api\V1\FhirToCdmController;
use App\Http\Controllers\Api\V1\GenomicEvidenceController;
use App\Http\Controllers\Api\V1\GenomicsController;
use App\Http\Controllers\Api\V1\GisAirQualityController;
use App\Http\Controllers\Api\V1\GisComorbidityController;
use App\Http\Controllers\Api\V1\GisController;
use App\Http\Controllers\Api\V1\GisEtlController;
use App\Http\Controllers\Api\V1\GisGeographyController;
use App\Http\Controllers\Api\V1\GisHospitalController;
use App\Http\Controllers\Api\V1\GisImportController;
use App\Http\Controllers\Api\V1\GisRuccController;
use App\Http\Controllers\Api\V1\GisSviController;
use App\Http\Controllers\Api\V1\GlobalSearchController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\HecateController;
use App\Http\Controllers\Api\V1\HelpController;
use App\Http\Controllers\Api\V1\HeorController;
use App\Http\Controllers\Api\V1\ImagingController;
use App\Http\Controllers\Api\V1\ImagingTimelineController;
use App\Http\Controllers\Api\V1\IncidenceRateController;
use App\Http\Controllers\Api\V1\IngestionController;
use App\Http\Controllers\Api\V1\IngestionProjectController;
use App\Http\Controllers\Api\V1\InvestigationController;
use App\Http\Controllers\Api\V1\InvestigationExportController;
use App\Http\Controllers\Api\V1\JobController;
use App\Http\Controllers\Api\V1\JupyterController;
use App\Http\Controllers\Api\V1\MappingReviewController;
use App\Http\Controllers\Api\V1\MorpheusDashboardController;
use App\Http\Controllers\Api\V1\MorpheusDatasetController;
use App\Http\Controllers\Api\V1\MorpheusPatientController;
use App\Http\Controllers\Api\V1\NegativeControlController;
use App\Http\Controllers\Api\V1\NetworkAnalysisController;
use App\Http\Controllers\Api\V1\NetworkAresController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\PathwayController;
use App\Http\Controllers\Api\V1\PatientProfileController;
use App\Http\Controllers\Api\V1\PatientSimilarityController;
use App\Http\Controllers\Api\V1\PhenotypeLibraryController;
use App\Http\Controllers\Api\V1\PopulationCharacterizationController;
use App\Http\Controllers\Api\V1\PopulationRiskScoreController;
use App\Http\Controllers\Api\V1\PoseidonController;
use App\Http\Controllers\Api\V1\PredictionController;
use App\Http\Controllers\Api\V1\PublicationController;
use App\Http\Controllers\Api\V1\PublicSurveyController;
use App\Http\Controllers\Api\V1\QueryLibraryController;
use App\Http\Controllers\Api\V1\RadiogenomicsController;
use App\Http\Controllers\Api\V1\RiskScoreAnalysisController;
use App\Http\Controllers\Api\V1\SccsController;
use App\Http\Controllers\Api\V1\SourceController;
use App\Http\Controllers\Api\V1\SourceProfilerController;
use App\Http\Controllers\Api\V1\StrategusController;
use App\Http\Controllers\Api\V1\StudyActivityController;
use App\Http\Controllers\Api\V1\StudyAgentController;
use App\Http\Controllers\Api\V1\StudyArtifactController;
use App\Http\Controllers\Api\V1\StudyCohortController;
use App\Http\Controllers\Api\V1\StudyController;
use App\Http\Controllers\Api\V1\StudyMilestoneController;
use App\Http\Controllers\Api\V1\StudyResultController;
use App\Http\Controllers\Api\V1\StudySiteController;
use App\Http\Controllers\Api\V1\StudyStatsController;
use App\Http\Controllers\Api\V1\StudySynthesisController;
use App\Http\Controllers\Api\V1\StudyTeamController;
use App\Http\Controllers\Api\V1\SurveyCampaignController;
use App\Http\Controllers\Api\V1\SurveyConductController;
use App\Http\Controllers\Api\V1\SurveyHonestBrokerController;
use App\Http\Controllers\Api\V1\SurveyInstrumentController;
use App\Http\Controllers\Api\V1\SyntheaController;
use App\Http\Controllers\Api\V1\TextToSqlController;
use App\Http\Controllers\Api\V1\UserProfileController;
use App\Http\Controllers\Api\V1\VocabularyController;
use App\Http\Controllers\Api\V1\WhiteRabbitController;
use App\Services\GIS\SpatialStatsProxy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;

// Public health check
Route::get('/health', [HealthController::class, 'index']);

// Broadcasting auth — registered under Sanctum so SPA bearer tokens work.
// Must use /api/broadcasting/auth path; Echo is configured to match.
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

// API v1
Route::prefix('v1')->group(function () {
    // Auth (public)
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,15');
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,15');

    // §9.2 — Public shared cohort link (no auth required)
    Route::get('/cohort-definitions/shared/{token}', [CohortDefinitionController::class, 'showShared']);

    // Poseidon webhook (Dagster → Laravel, secret-authenticated, no Sanctum)
    Route::post('/poseidon/webhooks/run-status', [PoseidonController::class, 'webhook'])
        ->middleware('throttle:60,1');

    // Protected routes
    Route::middleware(['auth:sanctum', 'source.resolve'])->group(function () {
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

        // Dashboard (unified stats — single call replaces 3+N frontend requests)
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

        // Jobs
        Route::get('/jobs', [JobController::class, 'index']);
        Route::get('/jobs/{job}', [JobController::class, 'show']);
        Route::post('/jobs/{job}/retry', [JobController::class, 'retry']);
        Route::post('/jobs/{job}/cancel', [JobController::class, 'cancel']);

        // Global search (across Solr cores: vocabulary, cohorts, studies)
        Route::get('/search', [GlobalSearchController::class, 'search']);

        // Claims search (Solr-powered)
        Route::get('/claims/search', [ClaimsSearchController::class, 'search']);

        // Achilles analysis search (across all sources, Solr-powered)
        Route::get('/analyses/search', [AchillesController::class, 'searchAnalyses']);

        // Sources — custom routes BEFORE apiResource to avoid route shadowing
        Route::post('sources/import-webapi', [SourceController::class, 'importWebApi']);
        Route::post('sources/test-connection', [SourceController::class, 'testConnection']);
        Route::put('sources/{source}/set-default', [SourceController::class, 'setDefault']);
        Route::delete('sources/default', [SourceController::class, 'clearDefault']);
        Route::apiResource('sources', SourceController::class);

        // Vocabulary
        Route::get('/vocabulary/search', [VocabularyController::class, 'search']);
        Route::get('/vocabulary/suggest', [VocabularyController::class, 'suggest']);
        Route::get('/vocabulary/concepts/{id}', [VocabularyController::class, 'show']);
        Route::get('/vocabulary/concepts/{id}/relationships', [VocabularyController::class, 'relationships']);
        Route::get('/vocabulary/concepts/{id}/ancestors', [VocabularyController::class, 'ancestors']);
        Route::post('/vocabulary/semantic-search', [VocabularyController::class, 'semanticSearch']);

        // Ingestion
        Route::post('/ingestion/upload', [IngestionController::class, 'upload'])
            ->middleware('permission:ingestion.upload');
        Route::get('/ingestion/jobs', [IngestionController::class, 'index'])
            ->middleware('permission:ingestion.view');
        Route::get('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'show'])
            ->middleware('permission:ingestion.view');
        Route::get('/ingestion/jobs/{ingestionJob}/profile', [IngestionController::class, 'profile'])
            ->middleware('permission:ingestion.view');
        Route::delete('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'destroy'])
            ->middleware('permission:ingestion.delete');
        Route::post('/ingestion/jobs/{ingestionJob}/retry', [IngestionController::class, 'retry'])
            ->middleware('permission:ingestion.run');

        // Mapping Review
        Route::get('/ingestion/mappings/search', [MappingReviewController::class, 'search'])
            ->middleware('permission:ingestion.view');
        Route::get('/ingestion/jobs/{ingestionJob}/mappings', [MappingReviewController::class, 'index'])
            ->middleware('permission:ingestion.view');
        Route::get('/ingestion/jobs/{ingestionJob}/mappings/stats', [MappingReviewController::class, 'stats'])
            ->middleware('permission:ingestion.view');
        Route::post('/ingestion/jobs/{ingestionJob}/mappings/{conceptMapping}/review', [MappingReviewController::class, 'review'])
            ->middleware('permission:ingestion.run');
        Route::post('/ingestion/jobs/{ingestionJob}/mappings/batch-review', [MappingReviewController::class, 'batchReview'])
            ->middleware('permission:ingestion.run');
        Route::get('/ingestion/jobs/{ingestionJob}/mappings/{conceptMapping}/candidates', [MappingReviewController::class, 'candidates'])
            ->middleware('permission:ingestion.view');

        // Schema Mapping
        Route::post('/ingestion/jobs/{ingestionJob}/schema-mapping/suggest', [IngestionController::class, 'suggestSchemaMapping'])
            ->middleware('permission:ingestion.run');
        Route::get('/ingestion/jobs/{ingestionJob}/schema-mapping', [IngestionController::class, 'getSchemaMapping'])
            ->middleware('permission:ingestion.view');
        Route::put('/ingestion/jobs/{ingestionJob}/schema-mapping', [IngestionController::class, 'updateSchemaMapping'])
            ->middleware('permission:ingestion.run');
        Route::post('/ingestion/jobs/{ingestionJob}/schema-mapping/confirm', [IngestionController::class, 'confirmSchemaMapping'])
            ->middleware('permission:ingestion.run');

        // Validation
        Route::get('/ingestion/jobs/{ingestionJob}/validation', [IngestionController::class, 'validation'])
            ->middleware('permission:ingestion.view');
        Route::get('/ingestion/jobs/{ingestionJob}/validation/summary', [IngestionController::class, 'validationSummary'])
            ->middleware('permission:ingestion.view');

        // Ingestion Projects (multi-file)
        Route::prefix('ingestion-projects')->group(function () {
            Route::get('/', [IngestionProjectController::class, 'index'])
                ->middleware('permission:ingestion.view');
            Route::post('/', [IngestionProjectController::class, 'store'])
                ->middleware('permission:ingestion.upload');
            Route::get('/{project}', [IngestionProjectController::class, 'show'])
                ->middleware('permission:ingestion.view')
                ->where('project', '[0-9]+');
            Route::put('/{project}', [IngestionProjectController::class, 'update'])
                ->middleware('permission:ingestion.upload')
                ->where('project', '[0-9]+');
            Route::delete('/{project}', [IngestionProjectController::class, 'destroy'])
                ->middleware('permission:ingestion.delete')
                ->where('project', '[0-9]+');
            Route::post('/{project}/stage', [IngestionProjectController::class, 'stage'])
                ->middleware(['permission:ingestion.upload', 'throttle:5,10'])
                ->where('project', '[0-9]+');
            Route::delete('/{project}/files/{job}', [IngestionProjectController::class, 'removeFile'])
                ->middleware('permission:ingestion.delete');
            Route::get('/{project}/preview/{table}', [IngestionProjectController::class, 'preview'])
                ->middleware('permission:ingestion.view')
                ->where(['project' => '[0-9]+', 'table' => '[a-z][a-z0-9_]*']);
            Route::get('/{project}/fields', [IngestionProjectController::class, 'fields'])
                ->middleware('permission:ingestion.view')
                ->where('project', '[0-9]+');
            Route::post('/{project}/connect-db', [IngestionProjectController::class, 'connectDb'])
                ->middleware('permission:ingestion.upload')
                ->where('project', '[0-9]+');
            Route::post('/{project}/confirm-tables', [IngestionProjectController::class, 'confirmTables'])
                ->middleware('permission:ingestion.upload')
                ->where('project', '[0-9]+');
            Route::post('/{project}/stage-db', [IngestionProjectController::class, 'stageDb'])
                ->middleware(['permission:ingestion.upload', 'throttle:5,10'])
                ->where('project', '[0-9]+');

            // FHIR workspace endpoints (Project Vulcan)
            Route::get('/{project}/fhir', [IngestionProjectController::class, 'fhir'])
                ->middleware('permission:ingestion.view')
                ->where('project', '[0-9]+');
            Route::post('/{project}/fhir/attach-connection', [IngestionProjectController::class, 'attachFhirConnection'])
                ->middleware('permission:ingestion.upload')
                ->where('project', '[0-9]+');
            Route::post('/{project}/fhir/sync', [IngestionProjectController::class, 'startFhirSync'])
                ->middleware('permission:ingestion.run')
                ->where('project', '[0-9]+');
            Route::get('/{project}/fhir/sync-runs', [IngestionProjectController::class, 'fhirSyncRuns'])
                ->middleware('permission:ingestion.view')
                ->where('project', '[0-9]+');
            Route::get('/{project}/fhir/sync-runs/{run}', [IngestionProjectController::class, 'fhirSyncRunDetail'])
                ->middleware('permission:ingestion.view')
                ->where(['project' => '[0-9]+', 'run' => '[0-9]+']);

            // Source Profiler for ingestion projects with DB connections
            Route::prefix('{project}/scan-profiles')->where(['project' => '[0-9]+'])->group(function () {
                Route::get('/', [SourceProfilerController::class, 'indexForProject'])
                    ->middleware('permission:ingestion.view');
                Route::post('/scan-async', [SourceProfilerController::class, 'scanAsyncForProject'])
                    ->middleware('permission:ingestion.run');
                Route::get('/scan-progress/{scanId}', [SourceProfilerController::class, 'scanProgress'])
                    ->middleware('permission:ingestion.view');
                Route::post('/scan-complete/{scanId}', [SourceProfilerController::class, 'scanCompleteForProject'])
                    ->middleware('permission:ingestion.run');
                Route::get('/{profile}', [SourceProfilerController::class, 'showForProject'])
                    ->middleware('permission:ingestion.view');
                Route::delete('/{profile}', [SourceProfilerController::class, 'destroyForProject'])
                    ->middleware('permission:ingestion.delete');
            });
        });

        // Poseidon (dbt + Dagster CDM Orchestration)
        Route::prefix('poseidon')->group(function () {
            Route::get('/dashboard', [PoseidonController::class, 'dashboard'])
                ->middleware('permission:ingestion.view');
            Route::get('/schedules', [PoseidonController::class, 'schedules'])
                ->middleware('permission:ingestion.view');
            Route::post('/schedules', [PoseidonController::class, 'storeSchedule'])
                ->middleware('permission:ingestion.run');
            Route::put('/schedules/{schedule}', [PoseidonController::class, 'updateSchedule'])
                ->middleware('permission:ingestion.run');
            Route::delete('/schedules/{schedule}', [PoseidonController::class, 'destroySchedule'])
                ->middleware('permission:ingestion.run');
            Route::get('/runs', [PoseidonController::class, 'runs'])
                ->middleware('permission:ingestion.view');
            Route::get('/runs/{run}', [PoseidonController::class, 'showRun'])
                ->middleware('permission:ingestion.view');
            Route::post('/runs/trigger', [PoseidonController::class, 'triggerRun'])
                ->middleware('permission:ingestion.run');
            Route::post('/runs/{run}/cancel', [PoseidonController::class, 'cancelRun'])
                ->middleware('permission:ingestion.run');
            Route::get('/freshness', [PoseidonController::class, 'freshness'])
                ->middleware('permission:ingestion.view');
            Route::get('/lineage', [PoseidonController::class, 'lineage'])
                ->middleware('permission:ingestion.view');
        });

        // Achilles (Data Characterization)
        Route::prefix('sources/{source}/achilles')->group(function () {
            Route::get('/record-counts', [AchillesController::class, 'recordCounts']);
            Route::get('/demographics', [AchillesController::class, 'demographics']);
            Route::get('/observation-periods', [AchillesController::class, 'observationPeriods']);
            Route::get('/domains/{domain}', [AchillesController::class, 'domainSummary']);
            Route::get('/domains/{domain}/concepts/{conceptId}', [AchillesController::class, 'conceptDrilldown']);
            Route::get('/domains/{domain}/hierarchy', [AchillesController::class, 'domainHierarchy']);
            Route::get('/temporal-trends', [AchillesController::class, 'temporalTrends']);
            Route::get('/analyses', [AchillesController::class, 'analyses']);
            Route::get('/performance', [AchillesController::class, 'performance']);
            Route::get('/distributions/{analysisId}', [AchillesController::class, 'distribution']);
            Route::get('/heel', [AchillesController::class, 'heel']);
            Route::get('/heel/runs', [AchillesController::class, 'heelRuns']);
            Route::get('/heel/runs/{runId}/progress', [AchillesController::class, 'heelProgress']);
            Route::post('/heel/run', [AchillesController::class, 'runHeel']);
            Route::get('/runs', [AchillesController::class, 'achillesRuns']);
            Route::get('/runs/{runId}/progress', [AchillesController::class, 'achillesProgress']);
            Route::post('/run', [AchillesController::class, 'run']);
        });

        // Ares (Release Management & Chart Annotations)
        Route::prefix('sources/{source}/ares')->group(function () {
            Route::get('/releases', [AresController::class, 'releases'])->middleware('permission:analyses.view');
            Route::post('/releases', [AresController::class, 'storeRelease'])->middleware('permission:analyses.create');
            Route::get('/releases/{release}', [AresController::class, 'showRelease'])->middleware('permission:analyses.view');
            Route::put('/releases/{release}', [AresController::class, 'updateRelease'])->middleware('permission:analyses.edit');
            Route::delete('/releases/{release}', [AresController::class, 'destroyRelease'])->middleware('permission:analyses.delete');
            Route::get('/annotations', [AresController::class, 'annotations'])->middleware('permission:analyses.view');
            Route::post('/annotations', [AresController::class, 'storeAnnotation'])->middleware('permission:analyses.create');
            Route::put('/annotations/{annotation}', [AresController::class, 'updateAnnotation'])->middleware('permission:analyses.edit');
            Route::delete('/annotations/{annotation}', [AresController::class, 'destroyAnnotation'])->middleware('permission:analyses.delete');
            Route::get('/annotations/timeline', [AresController::class, 'annotationTimeline'])->middleware('permission:analyses.view');

            // DQ History
            Route::get('/dq-history', [AresController::class, 'dqHistory'])->middleware('permission:analyses.view');
            Route::get('/dq-history/deltas', [AresController::class, 'dqHistoryDeltas'])->middleware('permission:analyses.view');
            Route::get('/dq-history/category-trends', [AresController::class, 'dqHistoryCategoryTrends'])->middleware('permission:analyses.view');
            Route::get('/dq-history/domain-trends', [AresController::class, 'dqHistoryDomainTrends'])->middleware('permission:analyses.view');
            Route::get('/dq-history/heatmap', [AresController::class, 'dqHistoryHeatmap'])->middleware('permission:analyses.view');
            Route::get('/dq-history/sparklines', [AresController::class, 'dqHistorySparklines'])->middleware('permission:analyses.view');
            Route::get('/dq-history/export', [AresController::class, 'dqHistoryExport'])->middleware('permission:analyses.view');

            // DQ Radar + SLA
            Route::get('/dq-radar', [AresController::class, 'dqRadar'])->middleware('permission:analyses.view');
            Route::post('/dq-sla', [AresController::class, 'dqSlaStore'])->middleware('role:admin|super-admin|data-steward');
            Route::get('/dq-sla', [AresController::class, 'dqSlaIndex'])->middleware('permission:analyses.view');
            Route::get('/dq-sla/compliance', [AresController::class, 'dqSlaCompliance'])->middleware('permission:analyses.view');

            // Unmapped Codes
            Route::get('/unmapped-codes', [AresController::class, 'unmappedCodes'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/summary', [AresController::class, 'unmappedCodesSummary'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/pareto', [AresController::class, 'unmappedCodesPareto'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/progress', [AresController::class, 'unmappedCodesProgress'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/treemap', [AresController::class, 'unmappedCodesTreemap'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/export', [AresController::class, 'unmappedCodesExport'])->middleware('permission:analyses.view');
            Route::get('/unmapped-codes/{codeId}/suggestions', [AresController::class, 'unmappedCodeSuggestions'])
                ->middleware(['permission:analyses.view', 'throttle:30,1']);
            Route::post('/unmapped-codes/{codeId}/map', [AresController::class, 'acceptMapping'])
                ->middleware('permission:mapping.review');

            // Domain Continuity
            Route::get('/domain-continuity', [AresController::class, 'domainContinuity'])->middleware('permission:analyses.view');

            // Diversity (source-scoped)
            Route::get('/diversity/age-pyramid', [AresController::class, 'diversityAgePyramid'])->middleware('permission:analyses.view');

            // Release Diff
            Route::get('/releases/{release}/diff', [AresController::class, 'releaseDiff'])->middleware('permission:analyses.view');

            // Cost
            Route::get('/cost/summary', [AresController::class, 'costSummary'])->middleware('permission:analyses.view');
            Route::get('/cost/trends', [AresController::class, 'costTrends'])->middleware('permission:analyses.view');
            Route::get('/cost/distribution', [AresController::class, 'costDistribution'])->middleware('permission:analyses.view');
            Route::get('/cost/care-setting', [AresController::class, 'costCareSetting'])->middleware('permission:analyses.view');
            Route::get('/cost/types', [AresController::class, 'costTypes'])->middleware('permission:analyses.view');
            Route::get('/cost/domains/{domain}', [AresController::class, 'costDomainDetail'])->middleware('permission:analyses.view');
            Route::get('/cost/drivers', [AresController::class, 'costDrivers'])->middleware('permission:analyses.view');

            // Diversity Trends (source-scoped)
            Route::get('/diversity/trends', [AresController::class, 'diversityTrends'])->middleware('permission:analyses.view');
        });

        // Network Ares — Cross-source intelligence
        Route::prefix('network/ares')->group(function () {
            Route::get('/overview', [NetworkAresController::class, 'overview'])->middleware('permission:analyses.view');

            // Concept comparison
            Route::get('/compare', [NetworkAresController::class, 'compare'])->middleware('permission:analyses.view');
            Route::get('/compare/search', [NetworkAresController::class, 'compareSearch'])->middleware('permission:analyses.view');
            Route::get('/compare/batch', [NetworkAresController::class, 'compareBatch'])
                ->middleware(['permission:analyses.view', 'throttle:30,1']);
            Route::get('/compare/multi', [NetworkAresController::class, 'compareMulti'])->middleware('permission:analyses.view');
            Route::get('/compare/funnel', [NetworkAresController::class, 'compareFunnel'])->middleware('permission:analyses.view');
            Route::get('/compare/standardized', [NetworkAresController::class, 'compareStandardized'])
                ->middleware(['permission:analyses.view', 'throttle:20,1']);
            Route::get('/compare/temporal', [NetworkAresController::class, 'compareTemporal'])->middleware('permission:analyses.view');
            Route::get('/compare/concept-set', [NetworkAresController::class, 'compareConceptSet'])
                ->middleware(['permission:analyses.view', 'throttle:20,1']);

            // Coverage + Diversity
            Route::get('/coverage', [NetworkAresController::class, 'coverage'])->middleware('permission:analyses.view');
            Route::get('/coverage/extended', [NetworkAresController::class, 'coverageExtended'])->middleware('permission:analyses.view');
            Route::get('/coverage/export', [NetworkAresController::class, 'coverageExport'])->middleware('permission:analyses.view');
            Route::get('/diversity', [NetworkAresController::class, 'diversity'])->middleware('permission:analyses.view');

            // Feasibility
            Route::post('/feasibility', [NetworkAresController::class, 'runFeasibility'])
                ->middleware(['permission:analyses.create', 'throttle:10,60']);
            Route::get('/feasibility', [NetworkAresController::class, 'listFeasibility'])->middleware('permission:analyses.view');
            Route::get('/feasibility/templates', [NetworkAresController::class, 'feasibilityTemplates'])->middleware('permission:analyses.view');
            Route::post('/feasibility/templates', [NetworkAresController::class, 'storeFeasibilityTemplate'])
                ->middleware(['permission:analyses.create']);
            Route::get('/feasibility/{id}', [NetworkAresController::class, 'showFeasibility'])->middleware('permission:analyses.view');
            Route::get('/feasibility/{id}/impact', [NetworkAresController::class, 'feasibilityImpact'])->middleware('permission:analyses.view');
            Route::get('/feasibility/{id}/forecast', [NetworkAresController::class, 'feasibilityForecast'])
                ->middleware(['permission:analyses.view', 'throttle:10,1']);

            // Alerts
            Route::get('/alerts', [NetworkAresController::class, 'alerts'])->middleware('permission:analyses.view');

            // Diversity (network-level)
            Route::get('/diversity/geographic', [NetworkAresController::class, 'diversityGeographic'])->middleware('permission:analyses.view');
            Route::post('/diversity/dap-check', [NetworkAresController::class, 'diversityDapCheck'])->middleware('permission:analyses.view');
            Route::get('/diversity/pooled', [NetworkAresController::class, 'diversityPooled'])->middleware('permission:analyses.view');

            // Releases (network-level)
            Route::get('/releases/timeline', [NetworkAresController::class, 'releasesTimeline'])->middleware('permission:analyses.view');
            Route::get('/releases/calendar', [NetworkAresController::class, 'releasesCalendar'])->middleware('permission:analyses.view');

            // Network DQ + Annotations + Cost
            Route::get('/dq-radar', [NetworkAresController::class, 'dqRadar'])->middleware('permission:analyses.view');
            Route::get('/dq-summary', [NetworkAresController::class, 'dqSummary'])->middleware('permission:analyses.view');
            Route::get('/dq-overlay', [NetworkAresController::class, 'dqOverlay'])->middleware('permission:analyses.view');
            Route::get('/annotations', [NetworkAresController::class, 'annotations'])->middleware('permission:analyses.view');
            Route::get('/cost', [NetworkAresController::class, 'cost'])->middleware('permission:analyses.view');
            Route::get('/cost/compare', [NetworkAresController::class, 'costCompare'])->middleware('permission:analyses.view');
            Route::get('/cost/compare/detailed', [NetworkAresController::class, 'costCompareDetailed'])->middleware('permission:analyses.view');
        });

        // Population Risk Scoring (Tier 3 — 20 validated clinical risk scores)
        Route::get('/risk-scores/catalogue', [PopulationRiskScoreController::class, 'catalogue']);
        Route::prefix('sources/{source}/risk-scores')->group(function () {
            Route::get('/', [PopulationRiskScoreController::class, 'index']);
            Route::post('/run', [PopulationRiskScoreController::class, 'run']);
            Route::get('/eligibility', [PopulationRiskScoreController::class, 'eligibility']);
            Route::post('/eligibility/refresh', [PopulationRiskScoreController::class, 'refreshEligibility']);
            Route::post('/recommend', [RiskScoreAnalysisController::class, 'recommend']);
            Route::get('/{scoreId}', [PopulationRiskScoreController::class, 'show']);
        });

        // Risk Score Analysis v2
        Route::middleware('permission:analyses.view')->group(function () {
            Route::get('risk-score-analyses', [RiskScoreAnalysisController::class, 'index']);
            Route::get('risk-score-analyses/stats', [RiskScoreAnalysisController::class, 'stats']);
            Route::get('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'show']);
            Route::get('risk-score-analyses/{analysis}/executions/{execution}', [RiskScoreAnalysisController::class, 'executionDetail']);
            Route::get('risk-score-analyses/{analysis}/executions/{execution}/patients', [RiskScoreAnalysisController::class, 'patients']);
        });
        Route::middleware('permission:analyses.create')->group(function () {
            Route::post('risk-score-analyses', [RiskScoreAnalysisController::class, 'store']);
            Route::put('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'update']);
            Route::delete('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'destroy']);
            Route::post('risk-score-analyses/{analysis}/execute', [RiskScoreAnalysisController::class, 'execute']);
            Route::post('risk-score-analyses/{analysis}/create-cohort', [RiskScoreAnalysisController::class, 'createCohort']);
        });

        // Clinical Coherence (Tier 1 Parthenon-native analyses)
        Route::prefix('sources/{source}/clinical-coherence')->group(function () {
            Route::get('/', [ClinicalCoherenceController::class, 'index']);
            Route::post('/run', [ClinicalCoherenceController::class, 'run']);
            Route::get('/{analysisId}', [ClinicalCoherenceController::class, 'show']);
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
            Route::get('/runs/{runId}/progress', [DataQualityController::class, 'progress']);
            Route::delete('/runs/{runId}', [DataQualityController::class, 'destroyRun']);
        });

        // Concept Sets — static routes BEFORE apiResource (avoid wildcard clash)
        Route::post('/concept-sets/import', [ConceptSetController::class, 'import']);
        Route::get('/concept-sets/stats', [ConceptSetController::class, 'stats']);
        Route::get('/concept-sets/tags', [ConceptSetController::class, 'tags']);
        Route::post('/concept-sets/from-bundle', [ConceptSetController::class, 'createFromBundle']);
        Route::apiResource('concept-sets', ConceptSetController::class);
        Route::get('/concept-sets/{concept_set}/export', [ConceptSetController::class, 'export']);
        Route::get('/concept-sets/{concept_set}/resolve', [ConceptSetController::class, 'resolve']);
        Route::post('/concept-sets/{concept_set}/copy', [ConceptSetController::class, 'copy']);
        Route::put('/concept-sets/{concept_set}/items/bulk', [ConceptSetController::class, 'bulkUpdateItems']);
        Route::post('/concept-sets/{concept_set}/items', [ConceptSetController::class, 'addItem']);
        Route::put('/concept-sets/{concept_set}/items/{item}', [ConceptSetController::class, 'updateItem']);
        Route::delete('/concept-sets/{concept_set}/items/{item}', [ConceptSetController::class, 'removeItem']);

        // Enhanced Vocabulary
        Route::get('/vocabulary/compare', [VocabularyController::class, 'compare']);
        Route::get('/vocabulary/concepts/{id}/descendants', [VocabularyController::class, 'descendants']);
        Route::get('/vocabulary/concepts/{id}/hierarchy', [VocabularyController::class, 'hierarchy']);
        Route::get('/vocabulary/concepts/{id}/maps-from', [VocabularyController::class, 'mapsFrom']);
        Route::get('/vocabulary/domains', [VocabularyController::class, 'domains']);
        Route::get('/vocabulary/vocabularies-list', [VocabularyController::class, 'vocabularies']);

        // Cohort Definitions — §9.2/9.4 static routes BEFORE apiResource (avoid wildcard clash)
        Route::post('/cohort-definitions/import', [CohortDefinitionController::class, 'import']);
        Route::get('/cohort-definitions/tags', [CohortDefinitionController::class, 'tags']);
        Route::get('/cohort-definitions/stats', [CohortDefinitionController::class, 'stats']);
        Route::post('/cohort-definitions/from-bundle', [CohortDefinitionController::class, 'createFromBundle']);
        Route::post('/cohort-definitions/compare', [CohortDefinitionController::class, 'compare']);
        Route::apiResource('cohort-definitions', CohortDefinitionController::class);
        Route::get('/cohort-definitions/{cohortDefinition}/export', [CohortDefinitionController::class, 'export']);
        Route::post('/cohort-definitions/{cohortDefinition}/share', [CohortDefinitionController::class, 'share']);
        Route::post('/cohort-definitions/{cohortDefinition}/generate', [CohortDefinitionController::class, 'generate']);
        Route::get('/cohort-definitions/{cohortDefinition}/generations', [CohortDefinitionController::class, 'generations']);
        Route::get('/cohort-definitions/{cohortDefinition}/generations/{generation}', [CohortDefinitionController::class, 'showGeneration']);
        Route::get('/cohort-definitions/{cohortDefinition}/sql', [CohortDefinitionController::class, 'previewSql']);
        Route::post('/cohort-definitions/{cohortDefinition}/copy', [CohortDefinitionController::class, 'copy']);
        Route::post('/cohort-definitions/{cohortDefinition}/diagnostics', [CohortDefinitionController::class, 'diagnostics']);

        // Analysis Stats (must be before resource routes)
        Route::get('analyses/stats', AnalysisStatsController::class);

        // ── Analyses (require analyses.view minimum, write ops need analyses.create/run) ──
        Route::middleware('permission:analyses.view')->group(function () {
            // Characterizations
            Route::apiResource('characterizations', CharacterizationController::class)
                ->only(['index', 'show']);
            Route::get('characterizations/{characterization}/executions', [CharacterizationController::class, 'executions']);
            Route::get('characterizations/{characterization}/executions/{execution}', [CharacterizationController::class, 'showExecution']);

            // Incidence Rates
            Route::apiResource('incidence-rates', IncidenceRateController::class)
                ->only(['index', 'show']);
            Route::get('incidence-rates/{incidenceRate}/executions', [IncidenceRateController::class, 'executions']);
            Route::get('incidence-rates/{incidenceRate}/executions/{execution}', [IncidenceRateController::class, 'showExecution']);

            // Pathways
            Route::apiResource('pathways', PathwayController::class)
                ->only(['index', 'show']);
            Route::get('pathways/{pathway}/executions', [PathwayController::class, 'executions']);
            Route::get('pathways/{pathway}/executions/{execution}', [PathwayController::class, 'showExecution']);

            // Estimation
            Route::apiResource('estimations', EstimationController::class)
                ->only(['index', 'show']);
            Route::get('estimations/{estimation}/executions', [EstimationController::class, 'executions']);
            Route::get('estimations/{estimation}/executions/{execution}', [EstimationController::class, 'showExecution']);

            // Prediction
            Route::apiResource('predictions', PredictionController::class)
                ->only(['index', 'show']);
            Route::get('predictions/{prediction}/executions', [PredictionController::class, 'executions']);
            Route::get('predictions/{prediction}/executions/{execution}', [PredictionController::class, 'showExecution']);

            // SCCS
            Route::apiResource('sccs', SccsController::class)
                ->only(['index', 'show']);
            Route::get('sccs/{scc}/executions', [SccsController::class, 'executions']);
            Route::get('sccs/{scc}/executions/{execution}', [SccsController::class, 'showExecution']);

            // Evidence Synthesis
            Route::apiResource('evidence-synthesis', EvidenceSynthesisController::class)
                ->parameters(['evidence-synthesis' => 'evidenceSynthesis'])
                ->only(['index', 'show']);
            Route::get('evidence-synthesis/{evidenceSynthesis}/executions', [EvidenceSynthesisController::class, 'executions']);
            Route::get('evidence-synthesis/{evidenceSynthesis}/executions/{execution}', [EvidenceSynthesisController::class, 'showExecution']);
        });

        Route::middleware('permission:analyses.create')->group(function () {
            Route::apiResource('characterizations', CharacterizationController::class)
                ->only(['store', 'update', 'destroy']);
            Route::post('characterizations/run-direct', [CharacterizationController::class, 'runDirect']);

            Route::apiResource('incidence-rates', IncidenceRateController::class)
                ->only(['store', 'update', 'destroy']);
            Route::post('incidence-rates/calculate-direct', [IncidenceRateController::class, 'calculateDirect']);

            Route::apiResource('pathways', PathwayController::class)
                ->only(['store', 'update', 'destroy']);

            Route::apiResource('estimations', EstimationController::class)
                ->only(['store', 'update', 'destroy']);

            Route::apiResource('predictions', PredictionController::class)
                ->only(['store', 'update', 'destroy']);

            Route::apiResource('sccs', SccsController::class)
                ->only(['store', 'update', 'destroy']);

            Route::apiResource('evidence-synthesis', EvidenceSynthesisController::class)
                ->parameters(['evidence-synthesis' => 'evidenceSynthesis'])
                ->only(['store', 'update', 'destroy']);
        });

        Route::middleware('permission:analyses.run')->group(function () {
            Route::post('characterizations/{characterization}/execute', [CharacterizationController::class, 'execute']);
            Route::post('incidence-rates/{incidenceRate}/execute', [IncidenceRateController::class, 'execute']);
            Route::post('pathways/{pathway}/execute', [PathwayController::class, 'execute']);
            Route::post('estimations/{estimation}/execute', [EstimationController::class, 'execute']);
            Route::post('predictions/{prediction}/execute', [PredictionController::class, 'execute']);
            Route::post('sccs/{scc}/execute', [SccsController::class, 'execute']);
            Route::post('evidence-synthesis/{evidenceSynthesis}/execute', [EvidenceSynthesisController::class, 'execute']);
        });

        // ── Studies (require studies.view minimum, write ops need studies.create/execute) ──
        Route::middleware('permission:studies.view')->group(function () {
            Route::get('studies/stats', StudyStatsController::class);
            Route::apiResource('studies', StudyController::class)
                ->only(['index', 'show']);
            Route::get('studies/{study}/progress', [StudyController::class, 'progress']);
            Route::get('studies/{study}/allowed-transitions', [StudyController::class, 'allowedTransitions']);
            Route::get('studies/{study}/analyses', [StudyController::class, 'analyses']);
        });

        Route::middleware('permission:studies.create')->group(function () {
            Route::apiResource('studies', StudyController::class)
                ->only(['store', 'update', 'destroy']);
            Route::post('studies/{study}/transition', [StudyController::class, 'transition']);
            Route::post('studies/{study}/analyses', [StudyController::class, 'addAnalysis']);
            Route::delete('studies/{study}/analyses/{studyAnalysis}', [StudyController::class, 'removeAnalysis']);
        });

        Route::middleware('permission:studies.execute')->group(function () {
            Route::post('studies/{study}/execute', [StudyController::class, 'executeAll']);
        });

        // Study sub-resources
        Route::prefix('studies/{study}')->group(function () {
            // Sites
            Route::get('sites', [StudySiteController::class, 'index']);
            Route::post('sites', [StudySiteController::class, 'store']);
            Route::get('sites/{site}', [StudySiteController::class, 'show']);
            Route::put('sites/{site}', [StudySiteController::class, 'update']);
            Route::delete('sites/{site}', [StudySiteController::class, 'destroy']);

            // Team members
            Route::get('team', [StudyTeamController::class, 'index']);
            Route::post('team', [StudyTeamController::class, 'store']);
            Route::put('team/{member}', [StudyTeamController::class, 'update']);
            Route::delete('team/{member}', [StudyTeamController::class, 'destroy']);

            // Cohorts
            Route::get('cohorts', [StudyCohortController::class, 'index']);
            Route::post('cohorts', [StudyCohortController::class, 'store']);
            Route::put('cohorts/{studyCohort}', [StudyCohortController::class, 'update']);
            Route::delete('cohorts/{studyCohort}', [StudyCohortController::class, 'destroy']);

            // Milestones
            Route::get('milestones', [StudyMilestoneController::class, 'index']);
            Route::post('milestones', [StudyMilestoneController::class, 'store']);
            Route::put('milestones/{milestone}', [StudyMilestoneController::class, 'update']);
            Route::delete('milestones/{milestone}', [StudyMilestoneController::class, 'destroy']);

            // Artifacts
            Route::get('artifacts', [StudyArtifactController::class, 'index']);
            Route::post('artifacts', [StudyArtifactController::class, 'store']);
            Route::put('artifacts/{artifact}', [StudyArtifactController::class, 'update']);
            Route::delete('artifacts/{artifact}', [StudyArtifactController::class, 'destroy']);

            // Results
            Route::get('results', [StudyResultController::class, 'index']);
            Route::get('results/{result}', [StudyResultController::class, 'show']);
            Route::put('results/{result}', [StudyResultController::class, 'update']);

            // Synthesis
            Route::get('synthesis', [StudySynthesisController::class, 'index']);
            Route::post('synthesis', [StudySynthesisController::class, 'store']);
            Route::get('synthesis/{synthesis}', [StudySynthesisController::class, 'show']);
            Route::delete('synthesis/{synthesis}', [StudySynthesisController::class, 'destroy']);

            // Activity log (read-only)
            Route::get('activity', [StudyActivityController::class, 'index']);
        });

        // Patient Profiles
        Route::get('clinical/search', [PatientProfileController::class, 'searchClinical']);
        Route::get('sources/{source}/persons/search', [PatientProfileController::class, 'search']);
        Route::get('sources/{source}/profiles/{personId}/stats', [PatientProfileController::class, 'stats']);
        Route::get('sources/{source}/profiles/{personId}/notes', [PatientProfileController::class, 'notes']);
        Route::get('sources/{source}/profiles/{personId}', [PatientProfileController::class, 'show']);
        Route::get('sources/{source}/cohorts/{cohortDefinitionId}/members', [PatientProfileController::class, 'members']);

        // Patient Similarity
        Route::prefix('patient-similarity')->group(function () {
            Route::post('/search', [PatientSimilarityController::class, 'search'])
                ->middleware(['permission:patient-similarity.view', 'throttle:30,1']);
            Route::get('/dimensions', [PatientSimilarityController::class, 'dimensions'])
                ->middleware('permission:patient-similarity.view');
            Route::get('/status/{sourceId}', [PatientSimilarityController::class, 'status'])
                ->middleware('permission:patient-similarity.view');
            Route::post('/compute', [PatientSimilarityController::class, 'compute'])
                ->middleware(['permission:patient-similarity.compute', 'throttle:5,60']);
            Route::post('/search-from-cohort', [PatientSimilarityController::class, 'searchFromCohort'])
                ->middleware(['permission:patient-similarity.view', 'throttle:30,1']);
            Route::post('/export-cohort', [PatientSimilarityController::class, 'exportCohort'])
                ->middleware('permission:patient-similarity.view');
            Route::get('/compare', [PatientSimilarityController::class, 'compare'])
                ->middleware(['permission:patient-similarity.view', 'permission:profiles.view']);
        });

        // Negative Control Outcomes
        Route::post('negative-controls/suggest', [NegativeControlController::class, 'suggest']);
        Route::post('negative-controls/validate', [NegativeControlController::class, 'validateCandidates']);

        // Notification Preferences
        Route::get('user/notification-preferences', [NotificationPreferenceController::class, 'show']);
        Route::put('user/notification-preferences', [NotificationPreferenceController::class, 'update']);

        // Onboarding
        Route::put('user/onboarding', [OnboardingController::class, 'complete']);

        // User Profile
        Route::put('user/profile', [UserProfileController::class, 'update'])
            ->middleware('throttle:10,1');
        Route::post('user/avatar', [UserProfileController::class, 'uploadAvatar'])
            ->middleware('throttle:10,1');
        Route::delete('user/avatar', [UserProfileController::class, 'deleteAvatar'])
            ->middleware('throttle:10,1');

        // Help & Changelog (§9.12)
        Route::get('/help/{key}', [HelpController::class, 'help']);
        Route::get('/changelog', [HelpController::class, 'changelog']);

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

        // Population Characterization (Tier 3 — PC001–PC006)
        Route::get('/population-insights/catalogue', [PopulationCharacterizationController::class, 'catalogue']);
        Route::prefix('sources/{source}/population-insights')->group(function () {
            Route::get('/', [PopulationCharacterizationController::class, 'index']);
            Route::post('/run', [PopulationCharacterizationController::class, 'run']);
            Route::get('/{analysisId}', [PopulationCharacterizationController::class, 'show']);
        });

        // Network Analytics (Tier 4)
        Route::prefix('network')->group(function () {
            Route::get('/analyses', [NetworkAnalysisController::class, 'index']);
            Route::get('/analyses/{analysisId}', [NetworkAnalysisController::class, 'show']);
            Route::post('/run', [NetworkAnalysisController::class, 'run']);
            Route::get('/summary', [NetworkAnalysisController::class, 'summary']);
        });

        // Abby AI
        Route::prefix('abby')->group(function () {
            Route::post('build-cohort', [AbbyAiController::class, 'buildCohort']);
            Route::post('create-cohort', [AbbyAiController::class, 'createCohort']);
            Route::post('chat', [AbbyAiController::class, 'chat']);
            Route::post('chat/stream', [AbbyAiController::class, 'chatStream']);
            Route::post('suggest-criteria', [AbbyAiController::class, 'suggestCriteria']);
            Route::post('explain', [AbbyAiController::class, 'explain']);
            Route::post('refine', [AbbyAiController::class, 'refine']);
            Route::post('suggest-protocol', [AbbyAiController::class, 'suggestProtocol']);
        });

        // Data Interrogation (Abby Analytics)
        Route::post('data-interrogation/ask', [DataInterrogationController::class, 'ask'])
            ->middleware('permission:analyses.view');

        // Abby Conversations (persistence)
        Route::apiResource('abby/conversations', AbbyConversationController::class)
            ->only(['index', 'store', 'show', 'destroy']);

        // Abby User Profile
        Route::prefix('abby/profile')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
            Route::get('/', [AbbyProfileController::class, 'show']);
            Route::put('/', [AbbyProfileController::class, 'update']);
            Route::post('/reset', [AbbyProfileController::class, 'reset']);
        });

        // Circe Cohort Compiler
        Route::prefix('circe')->group(function () {
            Route::post('/compile', [CirceController::class, 'compile']);
            Route::post('/validate', [CirceController::class, 'validate']);
            Route::post('/render', [CirceController::class, 'render']);
        });

        // Cohort Diagnostics (R Plumber proxy)
        Route::prefix('cohort-diagnostics')->group(function () {
            Route::post('/run', [CohortDiagnosticsController::class, 'run']);
        });

        // StudyAgent AI Assistant
        Route::prefix('study-agent')
            ->middleware(['role:researcher|super-admin', 'throttle:10,1'])
            ->group(function () {
                Route::get('/health', [StudyAgentController::class, 'health']);
                Route::get('/tools', [StudyAgentController::class, 'tools']);
                Route::get('/services', [StudyAgentController::class, 'services']);
                Route::get('/community-workbench-sdk/demo', [StudyAgentController::class, 'communityWorkbenchSdkDemo']);
                Route::post('/phenotype/search', [StudyAgentController::class, 'phenotypeSearch']);
                Route::post('/phenotype/recommend', [StudyAgentController::class, 'phenotypeRecommend']);
                Route::post('/phenotype/improve', [StudyAgentController::class, 'phenotypeImprove']);
                Route::post('/intent/split', [StudyAgentController::class, 'intentSplit']);
                Route::post('/cohort/lint', [StudyAgentController::class, 'cohortLint']);
                Route::post('/concept-set/review', [StudyAgentController::class, 'conceptSetReview']);
                Route::post('/lint-cohort', [StudyAgentController::class, 'lintCohortCombined']);
                Route::post('/recommend-phenotypes', [StudyAgentController::class, 'recommendPhenotypes']);
                Route::post('/finngen/cohort-operations', [StudyAgentController::class, 'finngenCohortOperations']);
                Route::post('/finngen/co2-analysis', [StudyAgentController::class, 'finngenCo2Analysis']);
                Route::post('/finngen/hades-extras', [StudyAgentController::class, 'finngenHadesExtras']);
                Route::post('/finngen/romopapi', [StudyAgentController::class, 'finngenRomopapi']);
                Route::get('/finngen/runs', [StudyAgentController::class, 'finngenRuns']);
                Route::get('/finngen/runs/{runId}', [StudyAgentController::class, 'finngenRun']);
                Route::post('/finngen/runs/{runId}/replay', [StudyAgentController::class, 'replayFinnGenRun']);
                Route::get('/finngen/runs/{runId}/export', [StudyAgentController::class, 'exportFinnGenRun']);
            });

        // Jupyter workbench
        Route::prefix('jupyter')->group(function () {
            // Authenticated endpoints (researcher, data-steward, admin, super-admin — NOT viewer)
            Route::middleware(['role:researcher|data-steward|admin|super-admin', 'throttle:10,1'])
                ->group(function () {
                    Route::get('/health', [JupyterController::class, 'health']);
                    Route::get('/workspace', [JupyterController::class, 'workspace']);
                    Route::post('/session', [JupyterController::class, 'session']);
                    Route::delete('/session', [JupyterController::class, 'destroySession']);
                });

            // Hub-to-Laravel endpoints (authenticated via X-Hub-Api-Key header, no Sanctum)
            Route::withoutMiddleware(['auth:sanctum'])
                ->middleware(['throttle:60,1'])
                ->group(function () {
                    Route::post('/audit', [JupyterController::class, 'audit']);
                });
        });

        // Publication / Export
        Route::post('publish/narrative', [PublicationController::class, 'narrative']);
        Route::post('publish/export', [PublicationController::class, 'export']);

        // ETL Tools
        Route::prefix('etl')->group(function () {
            // WhiteRabbit Database Profiler
            Route::post('/scan', [WhiteRabbitController::class, 'scan'])
                ->middleware('permission:profiler.scan');
            Route::get('/scan/health', [WhiteRabbitController::class, 'health']);

            // Synthea Data Generation
            Route::post('/synthea/generate', [SyntheaController::class, 'generate']);
            Route::get('/synthea/status', [SyntheaController::class, 'status']);

            // FHIR → CDM Conversion
            Route::post('/fhir/ingest', [FhirToCdmController::class, 'ingest']);
            Route::post('/fhir/batch', [FhirToCdmController::class, 'batch']);
            Route::get('/fhir/health', [FhirToCdmController::class, 'health']);

        });

        // Source Profiler (persisted WhiteRabbit scans)
        // Uses 'scan-profiles' to avoid collision with patient profiles at sources/{source}/profiles/{personId}
        Route::prefix('sources/{source}/scan-profiles')->group(function () {
            Route::get('/', [SourceProfilerController::class, 'index'])
                ->middleware('permission:profiler.view');
            Route::get('/compare', [SourceProfilerController::class, 'compare'])
                ->middleware('permission:profiler.view');
            Route::post('/scan', [SourceProfilerController::class, 'scan'])
                ->middleware(['permission:profiler.scan', 'throttle:3,10']);
            Route::post('/scan-async', [SourceProfilerController::class, 'scanAsync'])
                ->middleware(['permission:profiler.scan', 'throttle:3,10']);
            Route::get('/scan-progress/{scanId}', [SourceProfilerController::class, 'scanProgress'])
                ->middleware('permission:profiler.scan');
            Route::post('/scan-complete/{scanId}', [SourceProfilerController::class, 'scanComplete'])
                ->middleware('permission:profiler.scan');
            Route::get('/{profile}', [SourceProfilerController::class, 'show'])
                ->middleware('permission:profiler.view')
                ->where('profile', '[0-9]+');
            Route::delete('/{profile}', [SourceProfilerController::class, 'destroy'])
                ->middleware('permission:profiler.delete')
                ->where('profile', '[0-9]+');
        });

        // Aqueduct ETL Mapping Designer
        Route::prefix('etl-projects')->group(function () {
            Route::get('/', [EtlProjectController::class, 'index'])
                ->middleware('permission:etl.view');
            Route::post('/', [EtlProjectController::class, 'store'])
                ->middleware('permission:etl.create');
            Route::post('/{project}/suggest', [EtlProjectController::class, 'suggest'])
                ->middleware(['permission:etl.create', 'throttle:3,10'])
                ->where('project', '[0-9]+');
            Route::get('/{project}', [EtlProjectController::class, 'show'])
                ->middleware('permission:etl.view')
                ->where('project', '[0-9]+');
            Route::put('/{project}', [EtlProjectController::class, 'update'])
                ->middleware('permission:etl.create')
                ->where('project', '[0-9]+');
            Route::delete('/{project}', [EtlProjectController::class, 'destroy'])
                ->middleware('permission:etl.delete')
                ->where('project', '[0-9]+');

            // Table mappings
            Route::get('/{project}/table-mappings', [EtlProjectController::class, 'tableMappings'])
                ->middleware('permission:etl.view');
            Route::post('/{project}/table-mappings', [EtlProjectController::class, 'storeTableMapping'])
                ->middleware('permission:etl.create');
            Route::put('/{project}/table-mappings/{mapping}', [EtlProjectController::class, 'updateTableMapping'])
                ->middleware('permission:etl.create');
            Route::delete('/{project}/table-mappings/{mapping}', [EtlProjectController::class, 'destroyTableMapping'])
                ->middleware('permission:etl.create');

            // Field mappings
            Route::post('/{project}/table-mappings/{mapping}/suggest-fields', [EtlFieldMappingController::class, 'suggestFields'])
                ->middleware(['permission:etl.view', 'throttle:5,10']);
            Route::get('/{project}/table-mappings/{mapping}/fields', [EtlFieldMappingController::class, 'index'])
                ->middleware('permission:etl.view');
            Route::put('/{project}/table-mappings/{mapping}/fields', [EtlFieldMappingController::class, 'bulkUpsert'])
                ->middleware('permission:etl.create');

            // Export endpoints
            Route::get('/{project}/export/markdown', [EtlProjectController::class, 'exportMarkdown'])
                ->middleware('permission:etl.export')
                ->where('project', '[0-9]+');
            Route::get('/{project}/export/sql', [EtlProjectController::class, 'exportSql'])
                ->middleware('permission:etl.export')
                ->where('project', '[0-9]+');
            Route::get('/{project}/export/json', [EtlProjectController::class, 'exportJson'])
                ->middleware('permission:etl.export')
                ->where('project', '[0-9]+');
        });

        // Strategus Study Orchestration
        Route::prefix('strategus')->group(function () {
            Route::post('/execute', [StrategusController::class, 'execute']);
            Route::post('/validate', [StrategusController::class, 'validate']);
            Route::get('/modules', [StrategusController::class, 'modules']);
        });

        // Arachne Federated Execution
        Route::prefix('arachne')->middleware('permission:studies.execute')->group(function () {
            Route::get('/nodes', [ArachneController::class, 'nodes']);
            Route::post('/distribute', [ArachneController::class, 'distribute']);
            Route::get('/studies/{study}/status', [ArachneController::class, 'status']);
            Route::get('/studies/{study}/results/{execution}', [ArachneController::class, 'results']);
        });

        // Phenotype Library
        Route::prefix('phenotype-library')->group(function () {
            Route::get('/', [PhenotypeLibraryController::class, 'index']);
            Route::get('/stats', [PhenotypeLibraryController::class, 'stats']);
            Route::get('/domains', [PhenotypeLibraryController::class, 'domains']);
            Route::get('/{cohortId}', [PhenotypeLibraryController::class, 'show']);
            Route::post('/{cohortId}/import', [PhenotypeLibraryController::class, 'import']);
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
            Route::get('/users/{user}/audit', [UserAuditController::class, 'forUser']);
            Route::post('/users/broadcast-email', [UserController::class, 'broadcastEmail'])->middleware('role:super-admin');

            // ── User Audit Log ─────────────────────────────────────────────
            Route::prefix('user-audit')->group(function () {
                Route::get('/', [UserAuditController::class, 'index']);
                Route::get('/summary', [UserAuditController::class, 'summary']);
            });

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

            // ── AI provider configuration (super-admin only) ──────────────
            Route::middleware('role:super-admin')->prefix('ai-providers')->group(function () {
                Route::get('/', [AiProviderController::class, 'index']);
                Route::get('/{type}', [AiProviderController::class, 'show']);
                Route::put('/{type}', [AiProviderController::class, 'update']);
                Route::post('/{type}/enable', [AiProviderController::class, 'enable']);
                Route::post('/{type}/disable', [AiProviderController::class, 'disable']);
                Route::post('/{type}/activate', [AiProviderController::class, 'activate']);
                Route::post('/{type}/test', [AiProviderController::class, 'test']);
            });

            // ── WebAPI registry (admin+) ──────────────────────────────────
            Route::prefix('webapi-registries')->group(function () {
                Route::get('/', [WebApiRegistryController::class, 'index']);
                Route::post('/', [WebApiRegistryController::class, 'store']);
                Route::get('/{registry}', [WebApiRegistryController::class, 'show']);
                Route::put('/{registry}', [WebApiRegistryController::class, 'update']);
                Route::delete('/{registry}', [WebApiRegistryController::class, 'destroy']);
                Route::post('/{registry}/sync', [WebApiRegistryController::class, 'sync']);
            });

            // ── Atlas Migration Wizard (admin+) ──────────────────────────
            Route::prefix('atlas-migration')->group(function () {
                Route::post('/test-connection', [AtlasMigrationController::class, 'testConnection']);
                Route::post('/discover', [AtlasMigrationController::class, 'discover']);
                Route::post('/start', [AtlasMigrationController::class, 'start']);
                Route::get('/history', [AtlasMigrationController::class, 'history']);
                Route::get('/{migration}/status', [AtlasMigrationController::class, 'status']);
                Route::post('/{migration}/retry', [AtlasMigrationController::class, 'retry']);
            });

            // ── System health (admin+) ────────────────────────────────────
            Route::get('/system-health', [SystemHealthController::class, 'index']);
            Route::get('/system-health/{key}', [SystemHealthController::class, 'show']);

            // ── LiveKit configuration (super-admin only) ──────────────────
            Route::middleware('role:super-admin')->prefix('livekit-config')->group(function () {
                Route::get('/', [LiveKitConfigController::class, 'show']);
                Route::put('/', [LiveKitConfigController::class, 'update']);
                Route::post('/test', [LiveKitConfigController::class, 'test']);
            });

            // ── ChromaDB Studio (admin+) ──────────────────────────────────
            Route::prefix('chroma-studio')->group(function () {
                Route::get('/collections', [ChromaStudioController::class, 'collections']);
                Route::get('/collections/{name}/overview', [ChromaStudioController::class, 'collectionOverview']);
                Route::post('/query', [ChromaStudioController::class, 'query']);
                Route::post('/ingest-docs', [ChromaStudioController::class, 'ingestDocs']);
                Route::post('/ingest-clinical', [ChromaStudioController::class, 'ingestClinical']);
                Route::post('/promote-faq', [ChromaStudioController::class, 'promoteFaq']);
                Route::post('/ingest-ohdsi-papers', [ChromaStudioController::class, 'ingestOhdsiPapers']);
                Route::post('/ingest-ohdsi-knowledge', [ChromaStudioController::class, 'ingestOhdsiKnowledge']);
                Route::post('/ingest-textbooks', [ChromaStudioController::class, 'ingestTextbooks']);
                Route::post('/seed-faq', [ChromaStudioController::class, 'seedFaq']);
                Route::post('/aggregate-conversations', [ChromaStudioController::class, 'aggregateConversations']);
                Route::post('/collections/{name}/project', [ChromaStudioController::class, 'projectCollection']);
            });

            // ── Vocabulary management (super-admin only) ──────────────────
            Route::middleware('role:super-admin')->prefix('vocabulary')->group(function () {
                Route::get('/imports', [AdminVocabularyController::class, 'index']);
                Route::post('/upload', [AdminVocabularyController::class, 'upload']);
                Route::get('/imports/{vocabularyImport}', [AdminVocabularyController::class, 'show']);
                Route::delete('/imports/{vocabularyImport}', [AdminVocabularyController::class, 'destroy']);
            });

            // ── FHIR EHR Connections (super-admin only) ──────────────────
            Route::middleware('role:super-admin')->prefix('fhir-connections')->group(function () {
                Route::get('/', [FhirConnectionController::class, 'index']);
                Route::post('/', [FhirConnectionController::class, 'store']);
                Route::get('/{fhirConnection}', [FhirConnectionController::class, 'show']);
                Route::put('/{fhirConnection}', [FhirConnectionController::class, 'update']);
                Route::delete('/{fhirConnection}', [FhirConnectionController::class, 'destroy']);
                Route::post('/{fhirConnection}/test', [FhirConnectionController::class, 'testConnection']);
                Route::post('/{fhirConnection}/sync', [FhirConnectionController::class, 'startSync']);
                Route::get('/{fhirConnection}/sync-runs', [FhirConnectionController::class, 'syncRuns']);
                Route::get('/{fhirConnection}/sync-runs/{syncRun}', [FhirConnectionController::class, 'syncRunDetail']);
            });

            // ── FHIR Sync Dashboard (super-admin only) ──────────────────
            Route::middleware('role:super-admin')
                ->get('/fhir-sync/dashboard', [FhirConnectionController::class, 'syncDashboard']);

            // ── PACS Connections (super-admin only) ───────────────────────
            Route::middleware('role:super-admin')->prefix('pacs-connections')->group(function () {
                Route::get('/', [PacsConnectionController::class, 'index']);
                Route::post('/', [PacsConnectionController::class, 'store']);
                Route::get('/{pacsConnection}', [PacsConnectionController::class, 'show']);
                Route::put('/{pacsConnection}', [PacsConnectionController::class, 'update']);
                Route::delete('/{pacsConnection}', [PacsConnectionController::class, 'destroy']);
                Route::post('/{pacsConnection}/test', [PacsConnectionController::class, 'test']);
                Route::post('/{pacsConnection}/refresh-stats', [PacsConnectionController::class, 'refreshStats']);
                Route::get('/{pacsConnection}/studies', [PacsConnectionController::class, 'studies']);
                Route::post('/{pacsConnection}/set-default', [PacsConnectionController::class, 'setDefault']);
            });

            // ── Solr Admin (super-admin only) ──────────────────────────
            Route::middleware('role:super-admin')->prefix('solr')->group(function () {
                Route::get('/status', [SolrAdminController::class, 'status']);
                Route::post('/reindex/{core}', [SolrAdminController::class, 'reindex']);
                Route::post('/reindex-all', [SolrAdminController::class, 'reindexAll']);
                Route::post('/clear/{core}', [SolrAdminController::class, 'clear']);
            });
        });
    });
});

// ── Phase 15: Genomics ────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('genomics')->group(function () {
        Route::get('/stats', [GenomicsController::class, 'stats']);

        // VCF / MAF uploads
        Route::get('/uploads', [GenomicsController::class, 'indexUploads']);
        Route::post('/uploads', [GenomicsController::class, 'uploadFile']);
        Route::get('/uploads/{upload}', [GenomicsController::class, 'showUpload']);
        Route::delete('/uploads/{upload}', [GenomicsController::class, 'destroyUpload']);
        Route::post('/uploads/{upload}/match-persons', [GenomicsController::class, 'matchPersons']);
        Route::post('/uploads/{upload}/import', [GenomicsController::class, 'importToOmop']);

        // Analysis suite
        Route::get('/analysis/survival', [GenomicsController::class, 'survivalAnalysis']);
        Route::get('/analysis/treatment-matrix', [GenomicsController::class, 'treatmentMatrix']);
        Route::get('/analysis/characterization', [GenomicsController::class, 'characterization']);

        // Tumor Board
        Route::get('/tumor-board/{personId}', [GenomicsController::class, 'tumorBoard']);

        // Variants
        Route::get('/variants', [GenomicsController::class, 'indexVariants']);
        Route::get('/variants/{variant}', [GenomicsController::class, 'showVariant']);

        // ClinVar reference database
        Route::get('/clinvar/status', [GenomicsController::class, 'clinvarStatus']);
        Route::get('/clinvar/search', [GenomicsController::class, 'clinvarSearch']);
        Route::post('/clinvar/sync', [GenomicsController::class, 'clinvarSync']);
        Route::post('/uploads/{upload}/annotate-clinvar', [GenomicsController::class, 'annotateClinVar']);

        // Cohort criteria
        Route::get('/criteria', [GenomicsController::class, 'indexCriteria']);
        Route::post('/criteria', [GenomicsController::class, 'storeCriterion']);
        Route::put('/criteria/{criterion}', [GenomicsController::class, 'updateCriterion']);
        Route::delete('/criteria/{criterion}', [GenomicsController::class, 'destroyCriterion']);
    });
});

// ── Phase 16: DICOM Imaging ───────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('imaging')->group(function () {
        Route::get('/stats', [ImagingController::class, 'stats']);

        // Studies
        Route::get('/studies', [ImagingController::class, 'indexStudies']);
        Route::get('/studies/{study}', [ImagingController::class, 'showStudy']);
        Route::post('/studies/index-from-dicomweb', [ImagingController::class, 'indexFromDicomweb']);
        Route::post('/studies/{study}/index-series', [ImagingController::class, 'indexSeries']);
        Route::post('/studies/{study}/extract-nlp', [ImagingController::class, 'extractNlp']);

        // Features
        Route::get('/features', [ImagingController::class, 'indexFeatures']);

        // Cohort criteria
        Route::get('/criteria', [ImagingController::class, 'indexCriteria']);
        Route::post('/criteria', [ImagingController::class, 'storeCriterion']);
        Route::delete('/criteria/{criterion}', [ImagingController::class, 'destroyCriterion']);

        // Population analytics
        Route::get('/analytics/population', [ImagingController::class, 'populationAnalytics']);

        // Local DICOM import (from import_dicom.py — external Python script)
        Route::post('/import-local', [ImagingController::class, 'importLocal']);
        // UI-triggered import (PHP-native DICOM reader, no Python required)
        Route::post('/import-local/trigger', [ImagingController::class, 'triggerLocalImport']);

        // Instance listing (for viewer navigation)
        Route::get('/studies/{study}/instances', [ImagingController::class, 'listInstances']);

        // ── Imaging Outcomes Research ──────────────────────────────────────
        // Patient timelines
        Route::get('/patients', [ImagingTimelineController::class, 'listPatientsWithImaging']);
        Route::get('/patients/{personId}/timeline', [ImagingTimelineController::class, 'patientTimeline']);
        Route::get('/patients/{personId}/studies', [ImagingTimelineController::class, 'patientStudies']);

        // Study ↔ person linking
        Route::post('/studies/{study}/link-person', [ImagingTimelineController::class, 'linkPerson']);
        Route::post('/studies/bulk-link', [ImagingTimelineController::class, 'bulkLinkPerson']);
        Route::post('/studies/auto-link', [ImagingTimelineController::class, 'autoLink']);
        Route::post('/studies/link-by-condition', [ImagingTimelineController::class, 'linkByCondition']);

        // Measurements
        Route::get('/studies/{study}/measurements', [ImagingTimelineController::class, 'studyMeasurements']);
        Route::post('/studies/{study}/measurements', [ImagingTimelineController::class, 'storeMeasurement']);
        Route::put('/measurements/{measurement}', [ImagingTimelineController::class, 'updateMeasurement']);
        Route::delete('/measurements/{measurement}', [ImagingTimelineController::class, 'destroyMeasurement']);
        Route::get('/patients/{personId}/measurements', [ImagingTimelineController::class, 'patientMeasurements']);
        Route::get('/patients/{personId}/measurements/trends', [ImagingTimelineController::class, 'measurementTrends']);

        // AI-powered measurement extraction
        Route::post('/studies/{study}/ai-extract', [ImagingTimelineController::class, 'aiExtractMeasurements']);
        Route::get('/studies/{study}/suggest-template', [ImagingTimelineController::class, 'suggestTemplate']);

        // Response assessments
        Route::get('/patients/{personId}/response-assessments', [ImagingTimelineController::class, 'patientResponseAssessments']);
        Route::post('/patients/{personId}/response-assessments', [ImagingTimelineController::class, 'storeResponseAssessment']);
        Route::post('/patients/{personId}/compute-response', [ImagingTimelineController::class, 'computeResponse']);
        Route::post('/patients/{personId}/assess-preview', [ImagingTimelineController::class, 'assessPreview']);
    });
});

// WADO-URI: requires auth — use token query param for Cornerstone3D XHR compatibility
Route::prefix('v1/imaging')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::get('/wado/{sopUid}', [ImagingController::class, 'wado']);
});

// ── Phase 5: Radiogenomics ────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('radiogenomics')->group(function () {
        Route::get('/patients/{personId}', [RadiogenomicsController::class, 'patientPanel']);
        Route::get('/variant-drug-interactions', [RadiogenomicsController::class, 'variantDrugInteractions']);
    });
});

// ── GIS Epidemiology ────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('gis')->group(function () {
        Route::get('/boundaries', [GisController::class, 'boundaries']);
        Route::get('/boundaries/{id}', [GisController::class, 'boundaryDetail']);
        Route::get('/stats', [GisController::class, 'stats']);
        Route::post('/choropleth', [GisController::class, 'choropleth']);
        Route::get('/countries', [GisController::class, 'countries']);
        Route::get('/datasets', [GisController::class, 'datasets']);
        Route::get('/datasets/{id}', [GisController::class, 'datasetStatus']);
        Route::post('/load', [GisController::class, 'loadDataset'])->middleware('role:super-admin');

        // CDM Spatial (COVID explorer)
        Route::post('/cdm/choropleth', [GisController::class, 'cdmChoropleth']);
        Route::get('/cdm/time-periods', [GisController::class, 'cdmTimePeriods']);
        Route::get('/cdm/covid-summary', [GisController::class, 'covidSummary']);
        Route::get('/cdm/county/{gadmGid}', [GisController::class, 'countyDetail'])->where('gadmGid', '.*');
        Route::post('/cdm/refresh', [GisController::class, 'refreshCdmStats'])->middleware('role:super-admin');

        // CDM Spatial v2 (disease-agnostic)
        Route::get('/cdm/conditions', [GisController::class, 'cdmConditions']);
        Route::get('/cdm/conditions/categories', [GisController::class, 'cdmConditionCategories']);
        Route::get('/cdm/summary', [GisController::class, 'cdmSummary']);
        Route::post('/cdm/reindex-all', [GisController::class, 'cdmReindexAll'])->middleware('role:super-admin');
    });
});

// ── GIS Use Case Layers (v3) ───────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('gis')->group(function () {
        // Geography & layers
        Route::get('/layers', [GisGeographyController::class, 'layers']);
        Route::get('/geography/counties', [GisGeographyController::class, 'counties']);
        Route::get('/geography/tracts', [GisGeographyController::class, 'tracts']);

        // SVI (Use Case 1)
        Route::prefix('svi')->group(function () {
            Route::get('/choropleth', [GisSviController::class, 'choropleth']);
            Route::get('/quartile-analysis', [GisSviController::class, 'quartileAnalysis']);
            Route::get('/theme-correlations', [GisSviController::class, 'themeCorrelations']);
            Route::get('/tract-detail/{fips}', [GisSviController::class, 'tractDetail']);
        });

        // RUCC (Use Case 2)
        Route::prefix('rucc')->group(function () {
            Route::get('/choropleth', [GisRuccController::class, 'choropleth']);
            Route::get('/outcome-comparison', [GisRuccController::class, 'outcomeComparison']);
            Route::get('/county-detail/{fips}', [GisRuccController::class, 'countyDetail']);
        });

        // Comorbidity (Use Case 3)
        Route::prefix('comorbidity')->group(function () {
            Route::get('/choropleth', [GisComorbidityController::class, 'choropleth']);
            Route::get('/hotspots', [GisComorbidityController::class, 'hotspots']);
            Route::get('/burden-score', [GisComorbidityController::class, 'burdenScore']);
        });

        // Air Quality (Use Case 4)
        Route::prefix('air-quality')->group(function () {
            Route::get('/choropleth', [GisAirQualityController::class, 'choropleth']);
            Route::get('/respiratory-outcomes', [GisAirQualityController::class, 'respiratoryOutcomes']);
            Route::get('/county-detail/{fips}', [GisAirQualityController::class, 'countyDetail']);
        });

        // Hospital Access (Use Case 5)
        Route::prefix('hospitals')->group(function () {
            Route::get('/map-data', [GisHospitalController::class, 'mapData']);
            Route::get('/access-analysis', [GisHospitalController::class, 'accessAnalysis']);
            Route::get('/deserts', [GisHospitalController::class, 'deserts']);
        });

        // Spatial statistics (proxy to Python)
        Route::post('/spatial-stats', function (Request $request) {
            $request->validate([
                'analysis_type' => 'required|in:morans_i,hotspots,regression,correlation,drive_time',
                'variable' => 'required|string',
                'geography_level' => 'required|in:census_tract,county',
            ]);
            $proxy = app(SpatialStatsProxy::class);

            return response()->json(['data' => $proxy->compute($request->all())]);
        });

        // ETL Admin (super-admin only)
        Route::prefix('etl')->middleware('role:super-admin')->group(function () {
            Route::post('/load/{step}', [GisEtlController::class, 'load'])
                ->where('step', 'svi|rucc|air-quality|hospitals|crosswalk|all');
            Route::get('/status', [GisEtlController::class, 'status']);
        });
    });
});

// ── GIS Data Import (v2) ─────────────────────────────────────────────────────
Route::prefix('v1/gis/import')->middleware(['auth:sanctum', 'source.resolve', 'permission:gis.import', 'throttle:5,60'])->group(function () {
    // Non-parameterized routes FIRST (before {import} wildcard)
    Route::get('/history', [GisImportController::class, 'history']);
    Route::post('/upload', [GisImportController::class, 'upload']);

    // Parameterized routes
    Route::post('/{import}/analyze', [GisImportController::class, 'analyze']);
    Route::post('/{import}/ask', [GisImportController::class, 'ask']);
    Route::put('/{import}/mapping', [GisImportController::class, 'saveMapping']);
    Route::put('/{import}/config', [GisImportController::class, 'saveConfig']);
    Route::post('/{import}/validate', [GisImportController::class, 'validateImport']);
    Route::post('/{import}/execute', [GisImportController::class, 'execute']);
    Route::post('/{import}/learn', [GisImportController::class, 'learn']);
    Route::get('/{import}/status', [GisImportController::class, 'status']);
    Route::delete('/{import}', [GisImportController::class, 'rollback']);
});

// ── Phase 17: HEOR ───────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('heor')->group(function () {
        Route::get('/stats', [HeorController::class, 'stats']);

        // Analyses CRUD
        Route::get('/analyses', [HeorController::class, 'index']);
        Route::post('/analyses', [HeorController::class, 'store']);
        Route::get('/analyses/{analysis}', [HeorController::class, 'show']);
        Route::put('/analyses/{analysis}', [HeorController::class, 'update']);
        Route::delete('/analyses/{analysis}', [HeorController::class, 'destroy']);

        // Scenarios
        Route::get('/analyses/{analysis}/scenarios', [HeorController::class, 'indexScenarios']);
        Route::post('/analyses/{analysis}/scenarios', [HeorController::class, 'storeScenario']);
        Route::put('/analyses/{analysis}/scenarios/{scenario}', [HeorController::class, 'updateScenario']);
        Route::delete('/analyses/{analysis}/scenarios/{scenario}', [HeorController::class, 'destroyScenario']);

        // Parameters
        Route::get('/analyses/{analysis}/parameters', [HeorController::class, 'indexParameters']);
        Route::post('/analyses/{analysis}/parameters', [HeorController::class, 'storeParameter']);
        Route::put('/analyses/{analysis}/parameters/{parameter}', [HeorController::class, 'updateParameter']);
        Route::delete('/analyses/{analysis}/parameters/{parameter}', [HeorController::class, 'destroyParameter']);

        // Run + results
        Route::post('/analyses/{analysis}/run', [HeorController::class, 'run']);
        Route::get('/analyses/{analysis}/results', [HeorController::class, 'results']);

        // Value-based contracts
        Route::get('/contracts', [HeorController::class, 'indexContracts']);
        Route::post('/contracts', [HeorController::class, 'storeContract']);
        Route::get('/contracts/{contract}', [HeorController::class, 'showContract']);
        Route::put('/contracts/{contract}', [HeorController::class, 'updateContract']);
        Route::delete('/contracts/{contract}', [HeorController::class, 'destroyContract']);
        Route::post('/contracts/{contract}/simulate-rebate', [HeorController::class, 'simulateRebate']);
    });
});

// ── Hecate Semantic Vocabulary Search ────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('vocabulary/semantic')->group(function () {
        Route::get('/search', [HecateController::class, 'search']);
        Route::get('/search/standard', [HecateController::class, 'searchStandard']);
        Route::get('/concepts/{id}/relationships', [HecateController::class, 'conceptRelationships'])->whereNumber('id');
        Route::get('/concepts/{id}/phoebe', [HecateController::class, 'conceptPhoebe'])->whereNumber('id');
        Route::get('/concepts/{id}/definition', [HecateController::class, 'conceptDefinition'])->whereNumber('id');
        Route::get('/concepts/{id}/expand', [HecateController::class, 'conceptExpand'])->whereNumber('id');
        Route::get('/autocomplete', [HecateController::class, 'autocomplete']);
    });
});

// ── Ariadne Concept Mapping ───────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('ariadne')->group(function () {
        Route::post('/map', [AriadneController::class, 'map']);
        Route::post('/clean-terms', [AriadneController::class, 'cleanTerms']);
        Route::post('/vector-search', [AriadneController::class, 'vectorSearch']);
        Route::post('/save-mappings', [AriadneController::class, 'saveMappings'])->middleware('permission:mapping.review');
        Route::post('/projects', [AriadneController::class, 'saveProject'])->middleware('permission:mapping.view');
        Route::get('/projects', [AriadneController::class, 'listProjects'])->middleware('permission:mapping.view');
        Route::get('/projects/{project}', [AriadneController::class, 'loadProject'])->middleware('permission:mapping.view');
    });
});

// ── App Settings ─────────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::get('/app-settings', [AppSettingsController::class, 'index']);
    Route::patch('/app-settings', [AppSettingsController::class, 'update'])->middleware('role:super-admin');
});

// ── Text-to-SQL ───────────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('text-to-sql')->group(function () {
        Route::post('/generate', [TextToSqlController::class, 'generate']);
        Route::post('/validate', [TextToSqlController::class, 'validate']);
        Route::get('/schema', [TextToSqlController::class, 'schema']);
        Route::post('/execute', [TextToSqlController::class, 'execute']);
        Route::get('/execute/{executionId}/status', [TextToSqlController::class, 'executionStatus']);
        Route::get('/execute/{executionId}/download', [TextToSqlController::class, 'executionDownload']);
    });

    Route::prefix('query-library')->group(function () {
        Route::get('/', [QueryLibraryController::class, 'index']);
        Route::get('/{queryLibrary}', [QueryLibraryController::class, 'show']);
        Route::post('/{queryLibrary}/render', [QueryLibraryController::class, 'render']);
    });
});

// ── Commons Workspace ──────────────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    Route::prefix('commons')->group(function () {
        Route::get('users/search', [DirectMessageController::class, 'searchUsers']);
        Route::get('channels', [ChannelController::class, 'index']);
        Route::post('channels', [ChannelController::class, 'store']);
        Route::get('channels/unread', [MemberController::class, 'unreadCounts']);
        Route::get('channels/{slug}', [ChannelController::class, 'show']);
        Route::patch('channels/{slug}', [ChannelController::class, 'update']);
        Route::post('channels/{slug}/archive', [ChannelController::class, 'archive']);
        Route::get('channels/{slug}/call', [CallController::class, 'show']);
        Route::post('channels/{slug}/call/start', [CallController::class, 'start']);
        Route::post('channels/{slug}/call/token', [CallController::class, 'token']);
        Route::post('channels/{slug}/call/end', [CallController::class, 'end']);

        Route::get('channels/{slug}/messages', [MessageController::class, 'index']);
        Route::post('channels/{slug}/messages', [MessageController::class, 'store'])
            ->middleware('throttle:60,1');
        // Message search (must be before messages/{id} to avoid route conflict)
        Route::get('messages/search', [MessageController::class, 'search']);

        Route::patch('messages/{id}', [MessageController::class, 'update']);
        Route::delete('messages/{id}', [MessageController::class, 'destroy']);
        Route::get('channels/{slug}/messages/{messageId}/replies', [MessageController::class, 'replies']);

        Route::get('channels/{slug}/members', [MemberController::class, 'index']);
        Route::post('channels/{slug}/members', [MemberController::class, 'store']);
        Route::delete('channels/{slug}/members/{memberId}', [MemberController::class, 'destroy']);
        Route::patch('channels/{slug}/members/{memberId}', [MemberController::class, 'updatePreference']);
        Route::post('channels/{slug}/read', [MemberController::class, 'markRead']);
        Route::post('messages/{id}/reactions', [ReactionController::class, 'toggle'])
            ->middleware('throttle:30,1');

        // Pinned messages
        Route::get('channels/{slug}/pins', [PinController::class, 'index']);
        Route::post('channels/{slug}/pins', [PinController::class, 'store']);
        Route::delete('channels/{slug}/pins/{pinId}', [PinController::class, 'destroy']);

        // Direct messages
        Route::get('dm', [DirectMessageController::class, 'index']);
        Route::post('dm', [DirectMessageController::class, 'store']);

        // Object references
        Route::get('objects/search', [ObjectReferenceController::class, 'search']);
        Route::get('objects/{type}/{id}/discussions', [ObjectReferenceController::class, 'discussions']);

        // File attachments
        Route::post('channels/{slug}/attachments', [AttachmentController::class, 'store']);
        Route::get('attachments/{id}/download', [AttachmentController::class, 'download']);
        Route::delete('attachments/{id}', [AttachmentController::class, 'destroy']);

        // Review requests
        Route::get('channels/{slug}/reviews', [ReviewRequestController::class, 'index']);
        Route::post('channels/{slug}/reviews', [ReviewRequestController::class, 'store']);
        Route::patch('reviews/{id}/resolve', [ReviewRequestController::class, 'resolve']);

        // Notifications
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::post('notifications/mark-read', [NotificationController::class, 'markRead']);

        // Activity feed
        Route::get('activities', [ActivityController::class, 'global']);
        Route::get('channels/{slug}/activities', [ActivityController::class, 'index']);

        // Announcements
        Route::get('announcements', [AnnouncementController::class, 'index']);
        Route::post('announcements', [AnnouncementController::class, 'store']);
        Route::patch('announcements/{id}', [AnnouncementController::class, 'update']);
        Route::delete('announcements/{id}', [AnnouncementController::class, 'destroy']);
        Route::post('announcements/{id}/bookmark', [AnnouncementController::class, 'bookmark']);

        // Wiki / Knowledge Base
        Route::get('wiki', [WikiController::class, 'index']);
        Route::post('wiki', [WikiController::class, 'store']);
        Route::get('wiki/{slug}', [WikiController::class, 'show']);
        Route::patch('wiki/{slug}', [WikiController::class, 'update']);
        Route::delete('wiki/{slug}', [WikiController::class, 'destroy']);
        Route::get('wiki/{slug}/revisions', [WikiController::class, 'revisions']);

        // Abby feedback (thumbs up/down on responses)
        Route::post('abby/feedback', [AbbyAiController::class, 'feedback']);
    });
});

// ── Evidence Investigations ───────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    // ── Concept Explorer ─────────────────────────────────────────────────
    Route::prefix('concept-explorer')->group(function () {
        Route::get('/search', [ConceptExplorerController::class, 'search']);
        Route::get('/{conceptId}/hierarchy', [ConceptExplorerController::class, 'hierarchy']);
        Route::get('/{conceptId}/count', [ConceptExplorerController::class, 'patientCount']);
    });
    Route::prefix('investigations')->group(function () {
        Route::get('/', [InvestigationController::class, 'index']);
        Route::post('/', [InvestigationController::class, 'store']);
        Route::get('/{investigation}', [InvestigationController::class, 'show']);
        Route::patch('/{investigation}', [InvestigationController::class, 'update']);
        Route::delete('/{investigation}', [InvestigationController::class, 'destroy']);
        Route::patch('/{investigation}/state/{domain}', [InvestigationController::class, 'saveDomainState']);

        // Evidence Pins
        Route::get('/{investigation}/pins', [EvidencePinController::class, 'index']);
        Route::post('/{investigation}/pins', [EvidencePinController::class, 'store']);
        Route::patch('/{investigation}/pins/{pin}', [EvidencePinController::class, 'update']);
        Route::delete('/{investigation}/pins/{pin}', [EvidencePinController::class, 'destroy']);

        // Genomic Evidence Proxy + Cross-links
        Route::post('/{investigation}/genomic/query-opentargets', [GenomicEvidenceController::class, 'queryOpenTargets']);
        Route::post('/{investigation}/genomic/query-gwas-catalog', [GenomicEvidenceController::class, 'queryGwasCatalog']);
        Route::post('/{investigation}/genomic/upload-gwas', [GenomicEvidenceController::class, 'uploadGwas']);
        Route::get('/{investigation}/cross-links', [GenomicEvidenceController::class, 'crossLinks']);

        // Export + Versions
        Route::get('/{investigation}/export/json', [InvestigationExportController::class, 'exportJson']);
        Route::get('/{investigation}/export/pdf', [InvestigationExportController::class, 'exportPdf']);
        Route::get('/{investigation}/versions', [InvestigationExportController::class, 'listVersions']);
        Route::get('/{investigation}/versions/{versionNumber}', [InvestigationExportController::class, 'getVersion']);
        Route::post('/{investigation}/versions', [InvestigationExportController::class, 'createVersion']);
    });
});

// ── Morpheus Dashboard & Patient Journey ─────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    // TODO: Phase H — add permission:morpheus.view middleware per HIGHSEC spec
    // Morpheus Datasets
    Route::get('morpheus/datasets', [MorpheusDatasetController::class, 'index']);
    Route::get('morpheus/datasets/{datasetId}', [MorpheusDatasetController::class, 'show']);

    // Morpheus Dashboard
    Route::prefix('morpheus/dashboard')->group(function () {
        Route::get('/metrics', [MorpheusDashboardController::class, 'metrics']);
        Route::get('/trends', [MorpheusDashboardController::class, 'trends']);
        Route::get('/top-diagnoses', [MorpheusDashboardController::class, 'topDiagnoses']);
        Route::get('/top-procedures', [MorpheusDashboardController::class, 'topProcedures']);
        Route::get('/demographics', [MorpheusDashboardController::class, 'demographics']);
        Route::get('/los-distribution', [MorpheusDashboardController::class, 'losDistribution']);
        Route::get('/icu-units', [MorpheusDashboardController::class, 'icuUnits']);
        Route::get('/mortality-by-type', [MorpheusDashboardController::class, 'mortalityByType']);
        Route::get('/concept-stats/{conceptId}', [MorpheusDashboardController::class, 'conceptStats']);
    });

    Route::prefix('morpheus/patients')->group(function () {
        Route::get('/', [MorpheusPatientController::class, 'listPatients']);
        Route::get('/search', [MorpheusPatientController::class, 'searchPatients']);
        Route::get('/{subjectId}', [MorpheusPatientController::class, 'show']);
        Route::get('/{subjectId}/admissions', [MorpheusPatientController::class, 'admissions']);
        Route::get('/{subjectId}/transfers', [MorpheusPatientController::class, 'transfers']);
        Route::get('/{subjectId}/icu-stays', [MorpheusPatientController::class, 'icuStays']);
        Route::get('/{subjectId}/diagnoses', [MorpheusPatientController::class, 'diagnoses']);
        Route::get('/{subjectId}/procedures', [MorpheusPatientController::class, 'procedures']);
        Route::get('/{subjectId}/medications', [MorpheusPatientController::class, 'medications']);
        Route::get('/{subjectId}/lab-results', [MorpheusPatientController::class, 'labResults']);
        Route::get('/{subjectId}/vitals', [MorpheusPatientController::class, 'vitals']);
        Route::get('/{subjectId}/input-events', [MorpheusPatientController::class, 'inputEvents']);
        Route::get('/{subjectId}/output-events', [MorpheusPatientController::class, 'outputEvents']);
        Route::get('/{subjectId}/microbiology', [MorpheusPatientController::class, 'microbiology']);
        Route::get('/{subjectId}/services', [MorpheusPatientController::class, 'services']);
        Route::get('/{subjectId}/event-counts', [MorpheusPatientController::class, 'eventCounts']);
    });
});

// ── Survey Instruments (Standard PROs+) ─────────────────────────────────────
Route::prefix('v1/survey-instruments')->middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:surveys.view')->group(function () {
        Route::get('/', [SurveyInstrumentController::class, 'index']);
        Route::get('/domains', [SurveyInstrumentController::class, 'domains']);
        Route::get('/stats', [SurveyInstrumentController::class, 'stats']);
        Route::get('/{instrument}', [SurveyInstrumentController::class, 'show']);
        Route::get('/{instrument}/items', [SurveyInstrumentController::class, 'itemIndex']);
    });

    Route::middleware('permission:surveys.create')->group(function () {
        Route::post('/', [SurveyInstrumentController::class, 'store']);
        Route::post('/{instrument}/clone', [SurveyInstrumentController::class, 'clone']);
        Route::post('/{instrument}/items', [SurveyInstrumentController::class, 'itemStore']);
    });

    Route::middleware('permission:surveys.edit')->group(function () {
        Route::put('/{instrument}', [SurveyInstrumentController::class, 'update']);
        Route::put('/{instrument}/items/{item}', [SurveyInstrumentController::class, 'itemUpdate']);
    });

    Route::middleware('permission:surveys.delete')->group(function () {
        Route::delete('/{instrument}', [SurveyInstrumentController::class, 'destroy']);
        Route::delete('/{instrument}/items/{item}', [SurveyInstrumentController::class, 'itemDestroy']);
    });
});

Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'permission:surveys.view'])->group(function () {
    Route::get('/', [SurveyCampaignController::class, 'index']);
    Route::get('/{campaign}', [SurveyCampaignController::class, 'show']);
    Route::get('/{campaign}/stats', [SurveyCampaignController::class, 'stats']);
    Route::get('/{campaign}/conduct-records', [SurveyConductController::class, 'index']);
});

Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'permission:surveys.create'])->group(function () {
    Route::post('/', [SurveyCampaignController::class, 'store']);
    Route::post('/{campaign}/activate', [SurveyCampaignController::class, 'activate']);
    Route::post('/{campaign}/import', [SurveyCampaignController::class, 'import']);
});

Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'permission:surveys.edit'])->group(function () {
    Route::put('/{campaign}', [SurveyCampaignController::class, 'update']);
    Route::post('/{campaign}/close', [SurveyCampaignController::class, 'close']);
});

Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'role:data-steward|admin|super-admin'])->group(function () {
    Route::get('/{campaign}/honest-broker-links', [SurveyHonestBrokerController::class, 'index']);
    Route::post('/{campaign}/honest-broker-links', [SurveyHonestBrokerController::class, 'store']);
    Route::put('/{campaign}/honest-broker-links/{link}/contact', [SurveyHonestBrokerController::class, 'upsertContact']);
    Route::get('/{campaign}/honest-broker-invitations', [SurveyHonestBrokerController::class, 'invitations']);
    Route::get('/{campaign}/honest-broker-audit-logs', [SurveyHonestBrokerController::class, 'auditLogs']);
    Route::post('/{campaign}/honest-broker-invitations', [SurveyHonestBrokerController::class, 'sendInvitation']);
    Route::post('/{campaign}/honest-broker-invitations/{invitation}/resend', [SurveyHonestBrokerController::class, 'resendInvitation']);
    Route::post('/{campaign}/honest-broker-invitations/{invitation}/revoke', [SurveyHonestBrokerController::class, 'revokeInvitation']);
});

Route::prefix('v1/survey-campaigns')->middleware(['auth:sanctum', 'permission:surveys.delete'])->group(function () {
    Route::delete('/{campaign}', [SurveyCampaignController::class, 'destroy']);
});

Route::prefix('v1/survey-conduct')->middleware(['auth:sanctum', 'permission:surveys.edit'])->group(function () {
    Route::post('/{conduct}/responses', [SurveyConductController::class, 'storeResponses']);
});

Route::prefix('v1/survey-public')->group(function () {
    Route::get('/{token}', [PublicSurveyController::class, 'show']);
    Route::post('/{token}/responses', [PublicSurveyController::class, 'submit']);
});

// Catch-all for unknown API routes
Route::fallback(function () {
    return response()->json(['message' => 'Not Found'], 404);
});
