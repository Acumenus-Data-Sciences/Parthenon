<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunIncidenceRateJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Source;
use App\Services\Analysis\HadesBridgeService;
use App\Support\IncidenceRateResultNormalizer;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Group('Incidence Rates', weight: 70)]
class IncidenceRateController extends Controller
{
    /**
     * GET /v1/incidence-rates
     *
     * List all incidence rate analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = IncidenceRateAnalysis::with(['author:id,name,email'])
                ->orderByDesc('updated_at');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            }

            $analyses = $query->paginate($request->integer('per_page', 20));

            // Append latest execution info to each analysis
            $analyses->getCollection()->transform(function (IncidenceRateAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at']);

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve incidence rate analyses', $e);
        }
    }

    /**
     * POST /v1/incidence-rates
     *
     * Create a new incidence rate analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortId' => 'required|integer',
            'design_json.outcomeCohortIds' => 'required|array|min:1',
            'design_json.outcomeCohortIds.*' => 'integer',
            'design_json.timeAtRisk' => 'nullable|array',
            'design_json.timeAtRisk.start' => 'nullable|array',
            'design_json.timeAtRisk.start.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.start.offset' => 'nullable|integer',
            'design_json.timeAtRisk.end' => 'nullable|array',
            'design_json.timeAtRisk.end.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.end.offset' => 'nullable|integer',
            'design_json.stratifyByGender' => 'nullable|boolean',
            'design_json.stratifyByAge' => 'nullable|boolean',
            'design_json.ageGroups' => 'nullable|array',
            'design_json.ageGroups.*' => 'string',
            'design_json.minCellCount' => 'nullable|integer|min:1',
        ]);

        try {
            $analysis = IncidenceRateAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'Incidence rate analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create incidence rate analysis', $e);
        }
    }

    /**
     * GET /v1/incidence-rates/{incidenceRate}
     *
     * Show an incidence rate analysis with its executions.
     */
    public function show(IncidenceRateAnalysis $incidenceRate): JsonResponse
    {
        try {
            $incidenceRate->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $incidenceRate,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve incidence rate analysis', $e);
        }
    }

    /**
     * PUT /v1/incidence-rates/{incidenceRate}
     *
     * Update an incidence rate analysis.
     */
    public function update(Request $request, IncidenceRateAnalysis $incidenceRate): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortId' => 'required_with:design_json|integer',
            'design_json.outcomeCohortIds' => 'required_with:design_json|array|min:1',
            'design_json.outcomeCohortIds.*' => 'integer',
            'design_json.timeAtRisk' => 'nullable|array',
            'design_json.timeAtRisk.start' => 'nullable|array',
            'design_json.timeAtRisk.start.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.start.offset' => 'nullable|integer',
            'design_json.timeAtRisk.end' => 'nullable|array',
            'design_json.timeAtRisk.end.dateField' => 'nullable|string|in:StartDate,EndDate',
            'design_json.timeAtRisk.end.offset' => 'nullable|integer',
            'design_json.stratifyByGender' => 'nullable|boolean',
            'design_json.stratifyByAge' => 'nullable|boolean',
            'design_json.ageGroups' => 'nullable|array',
            'design_json.ageGroups.*' => 'string',
            'design_json.minCellCount' => 'nullable|integer|min:1',
        ]);

        try {
            $incidenceRate->update($validated);

            return response()->json([
                'data' => $incidenceRate->fresh('author:id,name,email'),
                'message' => 'Incidence rate analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update incidence rate analysis', $e);
        }
    }

    /**
     * DELETE /v1/incidence-rates/{incidenceRate}
     *
     * Soft delete an incidence rate analysis.
     */
    public function destroy(IncidenceRateAnalysis $incidenceRate): JsonResponse
    {
        try {
            $incidenceRate->delete();

            return response()->json([
                'message' => 'Incidence rate analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete incidence rate analysis', $e);
        }
    }

    /**
     * POST /v1/incidence-rates/{incidenceRate}/execute
     *
     * Dispatch an incidence rate execution job.
     */
    public function execute(Request $request, IncidenceRateAnalysis $incidenceRate): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => IncidenceRateAnalysis::class,
                'analysis_id' => $incidenceRate->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunIncidenceRateJob::dispatch($incidenceRate, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Incidence rate execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue incidence rate execution', $e);
        }
    }

    /**
     * GET /v1/incidence-rates/{incidenceRate}/executions
     *
     * List all executions for an incidence rate analysis.
     */
    public function executions(IncidenceRateAnalysis $incidenceRate): JsonResponse
    {
        try {
            $executions = $incidenceRate->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/incidence-rates/{incidenceRate}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        IncidenceRateAnalysis $incidenceRate,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $incidenceRate->id
            || $execution->analysis_type !== IncidenceRateAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this incidence rate analysis.'], 404);
        }

        try {
            $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($q) => $q->orderBy('created_at'),
            ]);

            if (is_array($execution->result_json)) {
                $execution->result_json = IncidenceRateResultNormalizer::normalize($execution->result_json);
            }

            return response()->json([
                'data' => $execution,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve execution', $e);
        }
    }

    /**
     * POST /v1/incidence-rates/calculate-direct
     *
     * Run OHDSI CohortIncidence package directly against a source,
     * returning real-time results (no queue). Proxies to R Plumber
     * at /analysis/cohort-incidence/calculate.
     */
    public function calculateDirect(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
            'targets' => 'required|array|min:1',
            'targets.*.cohort_id' => 'required|integer',
            'targets.*.cohort_name' => 'required|string',
            'outcomes' => 'required|array|min:1',
            'outcomes.*.cohort_id' => 'required|integer',
            'outcomes.*.cohort_name' => 'required|string',
            'outcomes.*.clean_window' => 'sometimes|integer|min:0',
            'time_at_risk' => 'required|array|min:1',
            'time_at_risk.*.start_offset' => 'required|integer',
            'time_at_risk.*.start_anchor' => 'required|string|in:era_start,era_end',
            'time_at_risk.*.end_offset' => 'required|integer',
            'time_at_risk.*.end_anchor' => 'required|string|in:era_start,era_end',
            'strata' => 'sometimes|array',
            'strata.by_age' => 'sometimes|boolean',
            'strata.by_gender' => 'sometimes|boolean',
            'strata.by_year' => 'sometimes|boolean',
            'strata.age_breaks' => 'sometimes|array',
            'min_cell_count' => 'sometimes|integer|min:1|max:100',
        ]);

        try {
            /** @var Source $source */
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            $cdmSchema = $source->getTableQualifier(DaimonType::CDM) ?? 'omop';
            $resultsSchema = $source->getTableQualifier(DaimonType::Results) ?? 'public';

            $rRuntimeUrl = rtrim(config('services.r_runtime.url', 'http://darkstar:8787'), '/');

            $spec = [
                'connection' => HadesBridgeService::buildSourceSpec($source),
                'targets' => $validated['targets'],
                'outcomes' => $validated['outcomes'],
                'time_at_risk' => $validated['time_at_risk'],
                'cdm_database_schema' => $cdmSchema,
                'cohort_database_schema' => $resultsSchema,
                'cohort_table' => 'cohort',
                'min_cell_count' => $validated['min_cell_count'] ?? 5,
            ];

            if (isset($validated['strata'])) {
                $spec['strata'] = $validated['strata'];
            }

            Log::info('CohortIncidence calculateDirect started', [
                'targets' => count($validated['targets']),
                'outcomes' => count($validated['outcomes']),
                'source_id' => $validated['source_id'],
            ]);

            $response = Http::timeout(300)->post(
                "{$rRuntimeUrl}/analysis/cohort-incidence/calculate",
                $spec
            );

            if ($response->failed()) {
                Log::error('CohortIncidence R call failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return response()->json([
                    'error' => 'CohortIncidence calculation failed',
                    'detail' => $response->json('message') ?? $response->body(),
                ], $response->status() ?: 502);
            }

            return response()->json(['data' => $response->json()]);

        } catch (\Throwable $e) {
            Log::error('IncidenceRateController::calculateDirect exception', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Failed to calculate incidence rates',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Build a standardized error response for database/service failures.
     */
    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }
}
