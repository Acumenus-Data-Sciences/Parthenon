<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Http\Requests\StudyAgent\CohortLintRequest;
use App\Http\Requests\StudyAgent\ConceptSetReviewRequest;
use App\Http\Requests\StudyAgent\IntentSplitRequest;
use App\Http\Requests\StudyAgent\LintCohortRequest;
use App\Http\Requests\StudyAgent\PhenotypeImproveRequest;
use App\Http\Requests\StudyAgent\PhenotypeRecommendRequest;
use App\Http\Requests\StudyAgent\PhenotypeSearchRequest;
use App\Http\Requests\StudyAgent\RecommendPhenotypesRequest;
use App\Services\Aqueduct\AqueductService;
use App\Services\StudyAgent\CommunityWorkbenchSdkDemoService;
use App\Services\StudyAgent\FinnGenRunService;
use App\Services\StudyAgent\FinnGenWorkbenchService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Study Agent', weight: 216)]
class StudyAgentController extends Controller
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = rtrim(config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Check StudyAgent health.
     */
    public function health(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/health");

        if ($response->failed()) {
            return response()->json(['status' => 'unavailable'], 503);
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * List available StudyAgent tools.
     */
    public function tools(): JsonResponse
    {
        $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/tools");

        if ($response->failed()) {
            return response()->json(['error' => 'StudyAgent unavailable'], 503);
        }

        return response()->json(['data' => $response->json()]);
    }

    public function services(CommunityWorkbenchSdkDemoService $demoService, AqueductService $aqueductService): JsonResponse
    {
        $services = [];
        $warnings = [];

        try {
            $response = Http::timeout(10)->get("{$this->aiServiceUrl}/study-agent/services");
            if ($response->successful()) {
                $payload = $response->json();
                $services = is_array($payload['services'] ?? null) ? $payload['services'] : [];
                $warnings = is_array($payload['warnings'] ?? null) ? $payload['warnings'] : [];
            } else {
                $warnings[] = 'StudyAgent service registry proxy was unavailable; using Laravel fallback service registry.';
            }
        } catch (\Throwable $e) {
            $warnings[] = 'StudyAgent service registry proxy was unavailable; using Laravel fallback service registry.';
        }

        if ($services === []) {
            $services = $this->fallbackFinnGenServices();
        }

        $services = $this->appendServiceEntry($services, $demoService->serviceEntry());
        $services = $this->appendServiceEntry($services, $aqueductService->serviceEntry());

        return response()->json([
            'data' => [
                'services' => array_values($services),
                'warnings' => $warnings,
            ],
        ]);
    }

    public function communityWorkbenchSdkDemo(CommunityWorkbenchSdkDemoService $demoService): JsonResponse
    {
        return response()->json(['data' => $demoService->payload()]);
    }

    /**
     * Search the OHDSI PhenotypeLibrary.
     *
     * Uses hybrid dense+sparse retrieval to find relevant phenotypes.
     */
    public function phenotypeSearch(PhenotypeSearchRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(30)->post("{$this->aiServiceUrl}/study-agent/phenotype/search", $validated);

        if ($response->failed()) {
            Log::error('Phenotype search failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype search failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Get AI-ranked phenotype recommendations.
     *
     * Ranks phenotype search results by relevance to a study intent.
     */
    public function phenotypeRecommend(PhenotypeRecommendRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/study-agent/phenotype/recommend", $validated);

        if ($response->failed()) {
            Log::error('Phenotype recommend failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype recommendation failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Get AI-suggested improvements for a cohort definition.
     */
    public function phenotypeImprove(PhenotypeImproveRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post("{$this->aiServiceUrl}/study-agent/phenotype/improve", $validated);

        if ($response->failed()) {
            Log::error('Phenotype improve failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype improvement failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Split study intent into target and outcome.
     *
     * Parses a free-text study intent into structured target population
     * and outcome statements.
     */
    public function intentSplit(IntentSplitRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/intent/split", $validated);

        if ($response->failed()) {
            Log::error('Intent split failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Intent splitting failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Lint a cohort definition for design issues.
     *
     * Checks for empty concept sets, missing washout periods,
     * inverted time windows, and other design problems.
     */
    public function cohortLint(CohortLintRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/cohort/lint", $validated);

        if ($response->failed()) {
            Log::error('Cohort lint failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Cohort linting failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Review a concept set and propose improvements.
     */
    public function conceptSetReview(ConceptSetReviewRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(60)->post("{$this->aiServiceUrl}/study-agent/concept-set/review", $validated);

        if ($response->failed()) {
            Log::error('Concept set review failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Concept set review failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Combined lint: cohort critique + concept set review.
     */
    public function lintCohortCombined(LintCohortRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post(
            "{$this->aiServiceUrl}/study-agent/lint-cohort",
            $validated
        );

        if ($response->failed()) {
            Log::error('Combined lint failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Combined lint failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    /**
     * Convenience: phenotype recommendations from study description.
     */
    public function recommendPhenotypes(RecommendPhenotypesRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $response = Http::timeout(120)->post(
            "{$this->aiServiceUrl}/study-agent/recommend-phenotypes",
            $validated
        );

        if ($response->failed()) {
            Log::error('Recommend phenotypes failed', ['status' => $response->status()]);

            return response()->json(['error' => 'Phenotype recommendation failed'], $response->status());
        }

        return response()->json(['data' => $response->json()]);
    }

    public function finngenCohortOperations(Request $request, FinnGenWorkbenchService $workbench, FinnGenRunService $runs): JsonResponse
    {
        $validated = $request->validate([
            'source.id' => ['required', 'integer'],
            'cohort_definition' => ['required', 'array'],
            'execution_mode' => ['sometimes', 'string'],
            'import_mode' => ['sometimes', 'string'],
            'operation_type' => ['sometimes', 'string'],
            'atlas_cohort_ids' => ['sometimes', 'array'],
            'atlas_cohort_ids.*' => ['integer'],
            'atlas_import_behavior' => ['sometimes', 'string'],
            'cohort_table_name' => ['sometimes', 'string'],
            'file_name' => ['sometimes', 'string'],
            'file_format' => ['sometimes', 'string'],
            'file_row_count' => ['sometimes', 'integer'],
            'file_columns' => ['sometimes', 'array'],
            'file_columns.*' => ['string'],
            'file_contents' => ['sometimes', 'string'],
            'selected_cohort_ids' => ['sometimes', 'array'],
            'selected_cohort_ids.*' => ['integer'],
            'selected_cohort_labels' => ['sometimes', 'array'],
            'selected_cohort_labels.*' => ['string'],
            'primary_cohort_id' => ['sometimes', 'nullable', 'integer'],
            'matching_enabled' => ['sometimes', 'boolean'],
            'matching_strategy' => ['sometimes', 'string'],
            'matching_target' => ['sometimes', 'string'],
            'matching_covariates' => ['sometimes', 'array'],
            'matching_covariates.*' => ['string'],
            'matching_ratio' => ['sometimes', 'numeric'],
            'matching_caliper' => ['sometimes', 'numeric'],
            'export_target' => ['sometimes', 'string'],
        ]);

        $source = $this->resolveSource((int) data_get($validated, 'source.id'), $request);
        $result = $workbench->cohortOperations(
            $source,
            $validated['cohort_definition'],
            (string) ($validated['execution_mode'] ?? 'preview'),
            [
                'import_mode' => $validated['import_mode'] ?? 'json',
                'operation_type' => $validated['operation_type'] ?? 'union',
                'atlas_cohort_ids' => $validated['atlas_cohort_ids'] ?? [],
                'atlas_import_behavior' => $validated['atlas_import_behavior'] ?? 'auto',
                'cohort_table_name' => $validated['cohort_table_name'] ?? '',
                'file_name' => $validated['file_name'] ?? '',
                'file_format' => $validated['file_format'] ?? '',
                'file_row_count' => $validated['file_row_count'] ?? null,
                'file_columns' => $validated['file_columns'] ?? [],
                'file_contents' => $validated['file_contents'] ?? '',
                'selected_cohort_ids' => $validated['selected_cohort_ids'] ?? [],
                'selected_cohort_labels' => $validated['selected_cohort_labels'] ?? [],
                'primary_cohort_id' => $validated['primary_cohort_id'] ?? null,
                'matching_enabled' => $validated['matching_enabled'] ?? true,
                'matching_strategy' => $validated['matching_strategy'] ?? 'nearest-neighbor',
                'matching_target' => $validated['matching_target'] ?? 'primary_vs_comparators',
                'matching_covariates' => $validated['matching_covariates'] ?? [],
                'matching_ratio' => $validated['matching_ratio'] ?? 1,
                'matching_caliper' => $validated['matching_caliper'] ?? 0.2,
                'export_target' => $validated['export_target'] ?? '',
                'user_id' => $request->user()?->id,
            ],
        );

        $runs->record('finngen_cohort_operations', $source, $request->user(), $validated, $result);

        return response()->json(['data' => $result]);
    }

    public function finngenCo2Analysis(Request $request, FinnGenWorkbenchService $workbench, FinnGenRunService $runs): JsonResponse
    {
        $validated = $request->validate([
            'source.id' => ['required', 'integer'],
            'module_key' => ['required', 'string'],
            'cohort_label' => ['sometimes', 'string'],
            'outcome_name' => ['sometimes', 'string'],
            'cohort_context' => ['sometimes', 'array'],
            'comparator_label' => ['sometimes', 'string'],
            'sensitivity_label' => ['sometimes', 'string'],
            'burden_domain' => ['sometimes', 'string'],
            'exposure_window' => ['sometimes', 'string'],
            'stratify_by' => ['sometimes', 'string'],
            'time_window_unit' => ['sometimes', 'string'],
            'time_window_count' => ['sometimes', 'numeric'],
            'gwas_trait' => ['sometimes', 'string'],
            'gwas_method' => ['sometimes', 'string'],
        ]);

        $source = $this->resolveSource((int) data_get($validated, 'source.id'), $request);
        $result = $workbench->co2Analysis(
            $source,
            (string) $validated['module_key'],
            (string) ($validated['cohort_label'] ?? ''),
            (string) ($validated['outcome_name'] ?? ''),
            [
                'cohort_context' => is_array($validated['cohort_context'] ?? null) ? $validated['cohort_context'] : [],
                'comparator_label' => $validated['comparator_label'] ?? '',
                'sensitivity_label' => $validated['sensitivity_label'] ?? '',
                'burden_domain' => $validated['burden_domain'] ?? '',
                'exposure_window' => $validated['exposure_window'] ?? '',
                'stratify_by' => $validated['stratify_by'] ?? '',
                'time_window_unit' => $validated['time_window_unit'] ?? '',
                'time_window_count' => $validated['time_window_count'] ?? null,
                'gwas_trait' => $validated['gwas_trait'] ?? '',
                'gwas_method' => $validated['gwas_method'] ?? '',
            ],
        );

        $runs->record('finngen_co2_analysis', $source, $request->user(), $validated, $result);

        return response()->json(['data' => $result]);
    }

    public function finngenHadesExtras(Request $request, FinnGenWorkbenchService $workbench, FinnGenRunService $runs): JsonResponse
    {
        $validated = $request->validate([
            'source.id' => ['required', 'integer'],
            'sql_template' => ['required', 'string'],
            'package_name' => ['sometimes', 'string'],
            'render_target' => ['sometimes', 'string'],
            'config_profile' => ['sometimes', 'string'],
            'artifact_mode' => ['sometimes', 'string'],
            'package_skeleton' => ['sometimes', 'string'],
            'cohort_table' => ['sometimes', 'string'],
            'config_yaml' => ['sometimes', 'string'],
        ]);

        $source = $this->resolveSource((int) data_get($validated, 'source.id'), $request);
        $result = $workbench->hadesExtras(
            $source,
            (string) $validated['sql_template'],
            (string) ($validated['package_name'] ?? ''),
            (string) ($validated['render_target'] ?? ''),
            [
                'config_profile' => $validated['config_profile'] ?? '',
                'artifact_mode' => $validated['artifact_mode'] ?? '',
                'package_skeleton' => $validated['package_skeleton'] ?? '',
                'cohort_table' => $validated['cohort_table'] ?? '',
                'config_yaml' => $validated['config_yaml'] ?? '',
            ],
        );

        $runs->record('finngen_hades_extras', $source, $request->user(), $validated, $result);

        return response()->json(['data' => $result]);
    }

    public function finngenRomopapi(Request $request, FinnGenWorkbenchService $workbench, FinnGenRunService $runs): JsonResponse
    {
        $validated = $request->validate([
            'source.id' => ['required', 'integer'],
            'schema_scope' => ['sometimes', 'string'],
            'query_template' => ['sometimes', 'string'],
            'concept_domain' => ['sometimes', 'string'],
            'stratify_by' => ['sometimes', 'string'],
            'result_limit' => ['sometimes', 'integer'],
            'lineage_depth' => ['sometimes', 'integer'],
            'request_method' => ['sometimes', 'string'],
            'response_format' => ['sometimes', 'string'],
            'cache_mode' => ['sometimes', 'string'],
            'report_format' => ['sometimes', 'string'],
        ]);

        $source = $this->resolveSource((int) data_get($validated, 'source.id'), $request);
        $result = $workbench->romopapi(
            $source,
            (string) ($validated['schema_scope'] ?? ''),
            (string) ($validated['query_template'] ?? ''),
            [
                'concept_domain' => $validated['concept_domain'] ?? '',
                'stratify_by' => $validated['stratify_by'] ?? '',
                'result_limit' => $validated['result_limit'] ?? null,
                'lineage_depth' => $validated['lineage_depth'] ?? null,
                'request_method' => $validated['request_method'] ?? '',
                'response_format' => $validated['response_format'] ?? '',
                'cache_mode' => $validated['cache_mode'] ?? '',
                'report_format' => $validated['report_format'] ?? '',
            ],
        );

        $runs->record('finngen_romopapi', $source, $request->user(), $validated, $result);

        return response()->json(['data' => $result]);
    }

    public function finngenRuns(Request $request, FinnGenRunService $runs): JsonResponse
    {
        $validated = $request->validate([
            'service_name' => ['sometimes', 'string'],
            'source_id' => ['sometimes', 'integer'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        return response()->json([
            'data' => [
                'runs' => $runs->recent(
                    $validated['service_name'] ?? null,
                    isset($validated['source_id']) ? (int) $validated['source_id'] : null,
                    (int) ($validated['limit'] ?? 12),
                )->values()->all(),
            ],
        ]);
    }

    public function finngenRun(int $runId, FinnGenRunService $runs): JsonResponse
    {
        return response()->json(['data' => ['run' => $runs->detail($runId)]]);
    }

    public function replayFinnGenRun(int $runId, Request $request, FinnGenRunService $runs, FinnGenWorkbenchService $workbench): JsonResponse
    {
        $run = $runs->findModel($runId);
        $payload = is_array($run->request_payload ?? null) ? $run->request_payload : [];
        $sourceId = (int) data_get($payload, 'source.id', $run->source_id);
        $source = $this->resolveSource($sourceId, $request);

        $result = match ($run->service_name) {
            'finngen_cohort_operations' => $workbench->cohortOperations(
                $source,
                is_array($payload['cohort_definition'] ?? null) ? $payload['cohort_definition'] : [],
                (string) ($payload['execution_mode'] ?? 'preview'),
                [
                    'import_mode' => $payload['import_mode'] ?? 'json',
                    'operation_type' => $payload['operation_type'] ?? 'union',
                    'atlas_cohort_ids' => is_array($payload['atlas_cohort_ids'] ?? null) ? $payload['atlas_cohort_ids'] : [],
                    'cohort_table_name' => $payload['cohort_table_name'] ?? '',
                    'file_name' => $payload['file_name'] ?? '',
                    'file_format' => $payload['file_format'] ?? '',
                    'file_row_count' => $payload['file_row_count'] ?? null,
                    'file_columns' => is_array($payload['file_columns'] ?? null) ? $payload['file_columns'] : [],
                    'file_contents' => $payload['file_contents'] ?? '',
                    'selected_cohort_ids' => is_array($payload['selected_cohort_ids'] ?? null) ? $payload['selected_cohort_ids'] : [],
                    'selected_cohort_labels' => is_array($payload['selected_cohort_labels'] ?? null) ? $payload['selected_cohort_labels'] : [],
                    'primary_cohort_id' => $payload['primary_cohort_id'] ?? null,
                    'matching_enabled' => $payload['matching_enabled'] ?? true,
                    'matching_strategy' => $payload['matching_strategy'] ?? 'nearest-neighbor',
                    'matching_target' => $payload['matching_target'] ?? 'primary_vs_comparators',
                    'matching_covariates' => is_array($payload['matching_covariates'] ?? null) ? $payload['matching_covariates'] : [],
                    'matching_ratio' => $payload['matching_ratio'] ?? 1,
                    'matching_caliper' => $payload['matching_caliper'] ?? 0.2,
                    'export_target' => $payload['export_target'] ?? '',
                    'user_id' => $request->user()?->id,
                ],
            ),
            'finngen_co2_analysis' => $workbench->co2Analysis(
                $source,
                (string) ($payload['module_key'] ?? 'comparative_effectiveness'),
                (string) ($payload['cohort_label'] ?? ''),
                (string) ($payload['outcome_name'] ?? ''),
                [
                    'cohort_context' => is_array($payload['cohort_context'] ?? null) ? $payload['cohort_context'] : [],
                    'comparator_label' => $payload['comparator_label'] ?? '',
                    'sensitivity_label' => $payload['sensitivity_label'] ?? '',
                    'burden_domain' => $payload['burden_domain'] ?? '',
                    'exposure_window' => $payload['exposure_window'] ?? '',
                    'stratify_by' => $payload['stratify_by'] ?? '',
                    'time_window_unit' => $payload['time_window_unit'] ?? '',
                    'time_window_count' => $payload['time_window_count'] ?? null,
                    'gwas_trait' => $payload['gwas_trait'] ?? '',
                    'gwas_method' => $payload['gwas_method'] ?? '',
                ],
            ),
            'finngen_hades_extras' => $workbench->hadesExtras(
                $source,
                (string) ($payload['sql_template'] ?? ''),
                (string) ($payload['package_name'] ?? ''),
                (string) ($payload['render_target'] ?? ''),
                [
                    'config_profile' => $payload['config_profile'] ?? '',
                    'artifact_mode' => $payload['artifact_mode'] ?? '',
                    'package_skeleton' => $payload['package_skeleton'] ?? '',
                    'cohort_table' => $payload['cohort_table'] ?? '',
                    'config_yaml' => $payload['config_yaml'] ?? '',
                ],
            ),
            'finngen_romopapi' => $workbench->romopapi(
                $source,
                (string) ($payload['schema_scope'] ?? ''),
                (string) ($payload['query_template'] ?? ''),
                [
                    'concept_domain' => $payload['concept_domain'] ?? '',
                    'stratify_by' => $payload['stratify_by'] ?? '',
                    'result_limit' => $payload['result_limit'] ?? null,
                    'lineage_depth' => $payload['lineage_depth'] ?? null,
                    'request_method' => $payload['request_method'] ?? '',
                    'response_format' => $payload['response_format'] ?? '',
                    'cache_mode' => $payload['cache_mode'] ?? '',
                    'report_format' => $payload['report_format'] ?? '',
                ],
            ),
            default => throw new \InvalidArgumentException('Unsupported FINNGEN run type.'),
        };

        $replayed = $runs->record($run->service_name, $source, $request->user(), $payload, $result);

        return response()->json(['data' => ['run' => $runs->detailForModel($replayed)]]);
    }

    public function exportFinnGenRun(int $runId, FinnGenRunService $runs): JsonResponse
    {
        return response()->json(['data' => $runs->exportBundle($runId)]);
    }

    private function resolveSource(int $sourceId, Request $request): Source
    {
        $query = Source::query()->with('daimons');
        if ($request->user() !== null) {
            $query->visibleToUser($request->user());
        }

        return $query->findOrFail($sourceId);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fallbackFinnGenServices(): array
    {
        return [
            [
                'name' => 'finngen_romopapi',
                'endpoint' => '/study-agent/finngen/romopapi',
                'description' => 'OMOP hierarchy and code count exploration.',
                'implemented' => true,
                'ui_hints' => ['title' => 'ROMOPAPI', 'summary' => 'OMOP query exploration.', 'repository' => 'https://github.com/FinnGen/ROMOPAPI'],
            ],
            [
                'name' => 'finngen_hades_extras',
                'endpoint' => '/study-agent/finngen/hades-extras',
                'description' => 'Shared OHDSI/HADES utility workflows.',
                'implemented' => true,
                'ui_hints' => ['title' => 'HADES Extras', 'summary' => 'SQL rendering and package workflows.', 'repository' => 'https://github.com/FinnGen/HadesExtras'],
            ],
            [
                'name' => 'finngen_cohort_operations',
                'endpoint' => '/study-agent/finngen/cohort-operations',
                'description' => 'Cohort import, operations, matching, and export.',
                'implemented' => true,
                'ui_hints' => ['title' => 'Cohort Operations', 'summary' => 'Cohort workbench and matching.', 'repository' => 'https://github.com/FinnGen/CohortOperations2'],
            ],
            [
                'name' => 'finngen_co2_analysis',
                'endpoint' => '/study-agent/finngen/co2-analysis',
                'description' => 'CO2 modular analysis workbench.',
                'implemented' => true,
                'ui_hints' => ['title' => 'CO2 Analysis Modules', 'summary' => 'CodeWAS, burden, demographics, utilization, and subgroup analysis.', 'repository' => 'https://github.com/FinnGen/CO2AnalysisModules'],
            ],
        ];
    }

    /**
     * @param  list<array<string,mixed>>  $services
     * @param  array<string,mixed>  $entry
     * @return list<array<string,mixed>>
     */
    private function appendServiceEntry(array $services, array $entry): array
    {
        foreach ($services as $service) {
            if (($service['name'] ?? null) === ($entry['name'] ?? null)) {
                return $services;
            }
        }

        $services[] = $entry;

        return $services;
    }
}
