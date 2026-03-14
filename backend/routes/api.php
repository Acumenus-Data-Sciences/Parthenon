<?php

use App\Http\Controllers\Api\V1\AbbyAiController;
use App\Http\Controllers\Api\V1\AbbyConversationController;
use App\Http\Controllers\Api\V1\AchillesController;
use App\Http\Controllers\Api\V1\Admin\AiProviderController;
use App\Http\Controllers\Api\V1\Admin\AtlasMigrationController;
use App\Http\Controllers\Api\V1\Admin\AuthProviderController;
use App\Http\Controllers\Api\V1\Admin\ChromaStudioController;
use App\Http\Controllers\Api\V1\Admin\FhirConnectionController;
use App\Http\Controllers\Api\V1\Admin\PacsConnectionController;
use App\Http\Controllers\Api\V1\Admin\RoleController;
use App\Http\Controllers\Api\V1\Admin\SolrAdminController;
use App\Http\Controllers\Api\V1\Admin\SystemHealthController;
use App\Http\Controllers\Api\V1\Admin\UserController;
use App\Http\Controllers\Api\V1\Admin\VocabularyController as AdminVocabularyController;
use App\Http\Controllers\Api\V1\Admin\WebApiRegistryController;
use App\Http\Controllers\Api\V1\AnalysisStatsController;
use App\Http\Controllers\Api\V1\AriadneController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CareGapController;
use App\Http\Controllers\Api\V1\CharacterizationController;
use App\Http\Controllers\Api\V1\CirceController;
use App\Http\Controllers\Api\V1\ClaimsSearchController;
use App\Http\Controllers\Api\V1\ClinicalCoherenceController;
use App\Http\Controllers\Api\V1\CohortDefinitionController;
use App\Http\Controllers\Api\V1\CohortDiagnosticsController;
use App\Http\Controllers\Api\V1\ConceptSetController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DataQualityController;
use App\Http\Controllers\Api\V1\EstimationController;
use App\Http\Controllers\Api\V1\EvidenceSynthesisController;
use App\Http\Controllers\Api\V1\FhirToCdmController;
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
use App\Http\Controllers\Api\V1\MappingReviewController;
use App\Http\Controllers\Api\V1\NegativeControlController;
use App\Http\Controllers\Api\V1\NetworkAnalysisController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\PathwayController;
use App\Http\Controllers\Api\V1\PatientProfileController;
use App\Http\Controllers\Api\V1\PhenotypeLibraryController;
use App\Http\Controllers\Api\V1\PopulationCharacterizationController;
use App\Http\Controllers\Api\V1\PopulationRiskScoreController;
use App\Http\Controllers\Api\V1\PredictionController;
use App\Http\Controllers\Api\V1\PublicationController;
use App\Http\Controllers\Api\V1\RadiogenomicsController;
use App\Http\Controllers\Api\V1\SccsController;
use App\Http\Controllers\Api\V1\SourceController;
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
use App\Http\Controllers\Api\V1\SyntheaController;
use App\Http\Controllers\Api\V1\TextToSqlController;
use App\Http\Controllers\Api\V1\UserProfileController;
use App\Http\Controllers\Api\V1\VocabularyController;
use App\Http\Controllers\Api\V1\WhiteRabbitController;
use App\Services\GIS\SpatialStatsProxy;
use Illuminate\Support\Facades\Route;

// Public health check
Route::get('/health', [HealthController::class, 'index']);

// API v1
Route::prefix('v1')->group(function () {
    // Auth (public)
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,15');
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,15');

    // §9.2 — Public shared cohort link (no auth required)
    Route::get('/cohort-definitions/shared/{token}', [CohortDefinitionController::class, 'showShared']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);

        // Dashboard (unified stats — single call replaces 3+N frontend requests)
        Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

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
        Route::post('/ingestion/upload', [IngestionController::class, 'upload']);
        Route::get('/ingestion/jobs', [IngestionController::class, 'index']);
        Route::get('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'show']);
        Route::get('/ingestion/jobs/{ingestionJob}/profile', [IngestionController::class, 'profile']);
        Route::delete('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'destroy']);
        Route::post('/ingestion/jobs/{ingestionJob}/retry', [IngestionController::class, 'retry']);

        // Mapping Review
        Route::get('/ingestion/mappings/search', [MappingReviewController::class, 'search']);
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
            Route::get('/heel', [AchillesController::class, 'heel']);
            Route::post('/heel/run', [AchillesController::class, 'runHeel']);
            Route::post('/run', [AchillesController::class, 'run']);
        });

        // Population Risk Scoring (Tier 3 — 20 validated clinical risk scores)
        Route::get('/risk-scores/catalogue', [PopulationRiskScoreController::class, 'catalogue']);
        Route::prefix('sources/{source}/risk-scores')->group(function () {
            Route::get('/', [PopulationRiskScoreController::class, 'index']);
            Route::post('/run', [PopulationRiskScoreController::class, 'run']);
            Route::get('/{scoreId}', [PopulationRiskScoreController::class, 'show']);
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

        // Characterizations
        Route::apiResource('characterizations', CharacterizationController::class);
        Route::post('characterizations/{characterization}/execute', [CharacterizationController::class, 'execute']);
        Route::get('characterizations/{characterization}/executions', [CharacterizationController::class, 'executions']);
        Route::get('characterizations/{characterization}/executions/{execution}', [CharacterizationController::class, 'showExecution']);
        Route::post('characterizations/run-direct', [CharacterizationController::class, 'runDirect']);

        // Incidence Rates
        Route::apiResource('incidence-rates', IncidenceRateController::class);
        Route::post('incidence-rates/{incidenceRate}/execute', [IncidenceRateController::class, 'execute']);
        Route::get('incidence-rates/{incidenceRate}/executions', [IncidenceRateController::class, 'executions']);
        Route::get('incidence-rates/{incidenceRate}/executions/{execution}', [IncidenceRateController::class, 'showExecution']);
        Route::post('incidence-rates/calculate-direct', [IncidenceRateController::class, 'calculateDirect']);

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

        // SCCS (Self-Controlled Case Series)
        Route::apiResource('sccs', SccsController::class);
        Route::post('sccs/{scc}/execute', [SccsController::class, 'execute']);
        Route::get('sccs/{scc}/executions', [SccsController::class, 'executions']);
        Route::get('sccs/{scc}/executions/{execution}', [SccsController::class, 'showExecution']);

        // Evidence Synthesis (Meta-Analysis)
        Route::apiResource('evidence-synthesis', EvidenceSynthesisController::class)
            ->parameters(['evidence-synthesis' => 'evidenceSynthesis']);
        Route::post('evidence-synthesis/{evidenceSynthesis}/execute', [EvidenceSynthesisController::class, 'execute']);
        Route::get('evidence-synthesis/{evidenceSynthesis}/executions', [EvidenceSynthesisController::class, 'executions']);
        Route::get('evidence-synthesis/{evidenceSynthesis}/executions/{execution}', [EvidenceSynthesisController::class, 'showExecution']);

        // Studies
        Route::get('studies/stats', StudyStatsController::class);
        Route::apiResource('studies', StudyController::class);
        Route::post('studies/{study}/execute', [StudyController::class, 'executeAll']);
        Route::get('studies/{study}/progress', [StudyController::class, 'progress']);
        Route::post('studies/{study}/transition', [StudyController::class, 'transition']);
        Route::get('studies/{study}/allowed-transitions', [StudyController::class, 'allowedTransitions']);
        Route::get('studies/{study}/analyses', [StudyController::class, 'analyses']);
        Route::post('studies/{study}/analyses', [StudyController::class, 'addAnalysis']);
        Route::delete('studies/{study}/analyses/{studyAnalysis}', [StudyController::class, 'removeAnalysis']);

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
            Route::put('cohorts/{cohort}', [StudyCohortController::class, 'update']);
            Route::delete('cohorts/{cohort}', [StudyCohortController::class, 'destroy']);

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

        // Abby Conversations (persistence)
        Route::apiResource('abby/conversations', AbbyConversationController::class)
            ->only(['index', 'store', 'show', 'destroy']);

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
                Route::post('/phenotype/search', [StudyAgentController::class, 'phenotypeSearch']);
                Route::post('/phenotype/recommend', [StudyAgentController::class, 'phenotypeRecommend']);
                Route::post('/phenotype/improve', [StudyAgentController::class, 'phenotypeImprove']);
                Route::post('/intent/split', [StudyAgentController::class, 'intentSplit']);
                Route::post('/cohort/lint', [StudyAgentController::class, 'cohortLint']);
                Route::post('/concept-set/review', [StudyAgentController::class, 'conceptSetReview']);
                Route::post('/lint-cohort', [StudyAgentController::class, 'lintCohortCombined']);
                Route::post('/recommend-phenotypes', [StudyAgentController::class, 'recommendPhenotypes']);
            });

        // Publication / Export
        Route::post('publish/narrative', [PublicationController::class, 'narrative']);
        Route::post('publish/export', [PublicationController::class, 'export']);

        // ETL Tools
        Route::prefix('etl')->group(function () {
            // WhiteRabbit Database Profiler
            Route::post('/scan', [WhiteRabbitController::class, 'scan']);
            Route::get('/scan/health', [WhiteRabbitController::class, 'health']);

            // Synthea Data Generation
            Route::post('/synthea/generate', [SyntheaController::class, 'generate']);
            Route::get('/synthea/status', [SyntheaController::class, 'status']);

            // FHIR → CDM Conversion
            Route::post('/fhir/ingest', [FhirToCdmController::class, 'ingest']);
            Route::post('/fhir/batch', [FhirToCdmController::class, 'batch']);
            Route::get('/fhir/health', [FhirToCdmController::class, 'health']);
        });

        // Strategus Study Orchestration
        Route::prefix('strategus')->group(function () {
            Route::post('/execute', [StrategusController::class, 'execute']);
            Route::post('/validate', [StrategusController::class, 'validate']);
            Route::get('/modules', [StrategusController::class, 'modules']);
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
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
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
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
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

// WADO-URI: public endpoint — Cornerstone3D XHR cannot send Sanctum session cookies
Route::prefix('v1/imaging')->group(function () {
    Route::get('/wado/{sopUid}', [ImagingController::class, 'wado']);
});

// ── Phase 5: Radiogenomics ────────────────────────────────────────────────
Route::prefix('v1')->middleware(['auth:sanctum'])->group(function () {
    Route::prefix('radiogenomics')->group(function () {
        Route::get('/patients/{personId}', [RadiogenomicsController::class, 'patientPanel']);
        Route::get('/variant-drug-interactions', [RadiogenomicsController::class, 'variantDrugInteractions']);
    });
});

// ── GIS Epidemiology ────────────────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
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
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
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
        Route::post('/spatial-stats', function (\Illuminate\Http\Request $request) {
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
Route::prefix('v1/gis/import')->middleware(['auth:sanctum', 'permission:gis.import', 'throttle:5,60'])->group(function () {
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
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
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
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::prefix('vocabulary/semantic')->group(function () {
        Route::get('/search', [HecateController::class, 'search']);
        Route::get('/search/standard', [HecateController::class, 'searchStandard']);
        Route::get('/concepts/{id}/relationships', [HecateController::class, 'conceptRelationships']);
        Route::get('/concepts/{id}/phoebe', [HecateController::class, 'conceptPhoebe']);
        Route::get('/concepts/{id}/definition', [HecateController::class, 'conceptDefinition']);
        Route::get('/concepts/{id}/expand', [HecateController::class, 'conceptExpand']);
        Route::get('/autocomplete', [HecateController::class, 'autocomplete']);
    });
});

// ── Ariadne Concept Mapping ───────────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::prefix('ariadne')->group(function () {
        Route::post('/map', [AriadneController::class, 'map']);
        Route::post('/clean-terms', [AriadneController::class, 'cleanTerms']);
        Route::post('/vector-search', [AriadneController::class, 'vectorSearch']);
    });
});

// ── Text-to-SQL ───────────────────────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::prefix('text-to-sql')->group(function () {
        Route::post('/generate', [TextToSqlController::class, 'generate']);
        Route::post('/validate', [TextToSqlController::class, 'validate']);
        Route::get('/schema', [TextToSqlController::class, 'schema']);
    });
});

// ── Commons Workspace ──────────────────────────────────────────────────────────
Route::prefix('v1')->middleware('auth:sanctum')->group(function () {
    Route::prefix('commons')->group(function () {
        Route::get('channels', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'index']);
        Route::post('channels', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'store']);
        Route::get('channels/unread', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'unreadCounts']);
        Route::get('channels/{slug}', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'show']);
        Route::patch('channels/{slug}', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'update']);
        Route::post('channels/{slug}/archive', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'archive']);

        Route::get('channels/{slug}/messages', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'index']);
        Route::post('channels/{slug}/messages', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'store'])
            ->middleware('throttle:60,1');
        // Message search (must be before messages/{id} to avoid route conflict)
        Route::get('messages/search', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'search']);

        Route::patch('messages/{id}', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'update']);
        Route::delete('messages/{id}', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'destroy']);
        Route::get('channels/{slug}/messages/{messageId}/replies', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'replies']);

        Route::get('channels/{slug}/members', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'index']);
        Route::post('channels/{slug}/members', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'store']);
        Route::delete('channels/{slug}/members/{memberId}', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'destroy']);
        Route::patch('channels/{slug}/members/{memberId}', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'updatePreference']);
        Route::post('channels/{slug}/read', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'markRead']);
        Route::post('messages/{id}/reactions', [App\Http\Controllers\Api\V1\Commons\ReactionController::class, 'toggle'])
            ->middleware('throttle:30,1');

        // Pinned messages
        Route::get('channels/{slug}/pins', [App\Http\Controllers\Api\V1\Commons\PinController::class, 'index']);
        Route::post('channels/{slug}/pins', [App\Http\Controllers\Api\V1\Commons\PinController::class, 'store']);
        Route::delete('channels/{slug}/pins/{pinId}', [App\Http\Controllers\Api\V1\Commons\PinController::class, 'destroy']);

        // Direct messages
        Route::get('dm', [App\Http\Controllers\Api\V1\Commons\DirectMessageController::class, 'index']);
        Route::post('dm', [App\Http\Controllers\Api\V1\Commons\DirectMessageController::class, 'store']);

        // Object references
        Route::get('objects/search', [App\Http\Controllers\Api\V1\Commons\ObjectReferenceController::class, 'search']);
        Route::get('objects/{type}/{id}/discussions', [App\Http\Controllers\Api\V1\Commons\ObjectReferenceController::class, 'discussions']);

        // File attachments
        Route::post('channels/{slug}/attachments', [App\Http\Controllers\Api\V1\Commons\AttachmentController::class, 'store']);
        Route::get('attachments/{id}/download', [App\Http\Controllers\Api\V1\Commons\AttachmentController::class, 'download']);
        Route::delete('attachments/{id}', [App\Http\Controllers\Api\V1\Commons\AttachmentController::class, 'destroy']);

        // Review requests
        Route::get('channels/{slug}/reviews', [App\Http\Controllers\Api\V1\Commons\ReviewRequestController::class, 'index']);
        Route::post('channels/{slug}/reviews', [App\Http\Controllers\Api\V1\Commons\ReviewRequestController::class, 'store']);
        Route::patch('reviews/{id}/resolve', [App\Http\Controllers\Api\V1\Commons\ReviewRequestController::class, 'resolve']);

        // Notifications
        Route::get('notifications', [App\Http\Controllers\Api\V1\Commons\NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [App\Http\Controllers\Api\V1\Commons\NotificationController::class, 'unreadCount']);
        Route::post('notifications/mark-read', [App\Http\Controllers\Api\V1\Commons\NotificationController::class, 'markRead']);

        // Activity feed
        Route::get('activities', [App\Http\Controllers\Api\V1\Commons\ActivityController::class, 'global']);
        Route::get('channels/{slug}/activities', [App\Http\Controllers\Api\V1\Commons\ActivityController::class, 'index']);

        // Announcements
        Route::get('announcements', [App\Http\Controllers\Api\V1\Commons\AnnouncementController::class, 'index']);
        Route::post('announcements', [App\Http\Controllers\Api\V1\Commons\AnnouncementController::class, 'store']);
        Route::patch('announcements/{id}', [App\Http\Controllers\Api\V1\Commons\AnnouncementController::class, 'update']);
        Route::delete('announcements/{id}', [App\Http\Controllers\Api\V1\Commons\AnnouncementController::class, 'destroy']);
        Route::post('announcements/{id}/bookmark', [App\Http\Controllers\Api\V1\Commons\AnnouncementController::class, 'bookmark']);

        // Wiki / Knowledge Base
        Route::get('wiki', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'index']);
        Route::post('wiki', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'store']);
        Route::get('wiki/{slug}', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'show']);
        Route::patch('wiki/{slug}', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'update']);
        Route::delete('wiki/{slug}', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'destroy']);
        Route::get('wiki/{slug}/revisions', [App\Http\Controllers\Api\V1\Commons\WikiController::class, 'revisions']);
    });
});

// Catch-all for unknown API routes
Route::fallback(function () {
    return response()->json(['message' => 'Not Found'], 404);
});
