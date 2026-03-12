<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DaimonType;
use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Services\Analysis\HadesBridgeService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Cohort Diagnostics', weight: 120)]
class CohortDiagnosticsController extends Controller
{
    private string $rRuntimeUrl;

    public function __construct()
    {
        $this->rRuntimeUrl = rtrim(config('services.r_runtime.url', 'http://r-runtime:8787'), '/');
    }

    /**
     * POST /api/v1/cohort-diagnostics/run
     *
     * Run CohortDiagnostics for one or more cohort definitions against a CDM source.
     * Proxies to the R Plumber endpoint at /analysis/cohort-diagnostics/run.
     *
     * Accepts the cohort_definition_id(s) and a source_id; resolves the CDM
     * connection details from the Source model so the frontend does not have to
     * supply raw database credentials.
     *
     * Diagnostic toggles (all optional, default true unless noted):
     *   - run_incidence_rate         (default: true)
     *   - run_orphan_concepts        (default: true)
     *   - run_breakdown_index_events (default: true)
     *   - run_visit_context          (default: true)
     *   - run_inclusion_statistics   (default: true)
     *   - run_temporal_characterization (default: false — expensive)
     *   - min_cell_count             (default: 5)
     */
    public function run(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cohort_definition_ids' => 'required|array|min:1',
            'cohort_definition_ids.*' => 'integer|exists:cohort_definitions,id',
            'source_id' => 'required|integer|exists:sources,id',
            'run_incidence_rate' => 'sometimes|boolean',
            'run_orphan_concepts' => 'sometimes|boolean',
            'run_breakdown_index_events' => 'sometimes|boolean',
            'run_visit_context' => 'sometimes|boolean',
            'run_inclusion_statistics' => 'sometimes|boolean',
            'run_temporal_characterization' => 'sometimes|boolean',
            'min_cell_count' => 'sometimes|integer|min:1|max:100',
        ]);

        try {
            /** @var Source $source */
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Resolve schema names from daimons
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM) ?? 'cdm';
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results) ?? 'public';

            // Load cohort definitions and build cohortDefinitionSet for R
            $cohorts = CohortDefinition::whereIn('id', $validated['cohort_definition_ids'])
                ->select(['id', 'name', 'expression_json'])
                ->get();

            if ($cohorts->isEmpty()) {
                return response()->json([
                    'error' => 'No cohort definitions found for the given IDs.',
                ], 404);
            }

            $cohortDefinitions = $cohorts->map(function (CohortDefinition $cd) {
                return [
                    'cohortId' => $cd->id,
                    'cohortName' => $cd->name,
                    'json' => $cd->expression_json ?? (object) [],
                    'sql' => '',
                ];
            })->values()->toArray();

            // Build the spec forwarded to R
            $spec = [
                'connection' => HadesBridgeService::buildSourceSpec($source),
                'cohort_ids' => $cohorts->pluck('id')->toArray(),
                'cohort_definitions' => $cohortDefinitions,
                'cdm_database_schema' => $cdmSchema,
                'cohort_database_schema' => $resultsSchema,
                'vocabulary_database_schema' => $vocabSchema,
                'cohort_table' => 'cohort',
                'database_id' => $source->source_key ?? 'default',
                'run_incidence_rate' => $validated['run_incidence_rate'] ?? true,
                'run_orphan_concepts' => $validated['run_orphan_concepts'] ?? true,
                'run_breakdown_index_events' => $validated['run_breakdown_index_events'] ?? true,
                'run_visit_context' => $validated['run_visit_context'] ?? true,
                'run_inclusion_statistics' => $validated['run_inclusion_statistics'] ?? true,
                'run_temporal_characterization' => $validated['run_temporal_characterization'] ?? false,
                'min_cell_count' => $validated['min_cell_count'] ?? 5,
            ];

            Log::info('CohortDiagnostics run started', [
                'cohort_ids' => $validated['cohort_definition_ids'],
                'source_id' => $validated['source_id'],
            ]);

            // Diagnostics can take several minutes — use 300s timeout
            $response = Http::timeout(300)->post(
                "{$this->rRuntimeUrl}/analysis/cohort-diagnostics/run",
                $spec
            );

            if ($response->failed()) {
                Log::error('CohortDiagnostics R call failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'Cohort Diagnostics execution failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('CohortDiagnosticsController::run exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to run cohort diagnostics',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
