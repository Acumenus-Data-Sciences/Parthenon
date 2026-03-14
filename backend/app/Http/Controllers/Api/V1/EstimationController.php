<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunEstimationJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Source;
use App\Support\EstimationResultNormalizer;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Population-Level Estimation', weight: 90)]
class EstimationController extends Controller
{
    /**
     * GET /v1/estimations
     *
     * List all estimation analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = EstimationAnalysis::with(['author:id,name,email'])
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
            $analyses->getCollection()->transform(function (EstimationAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at']);

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve estimation analyses', $e);
        }
    }

    /**
     * POST /v1/estimations
     *
     * Create a new estimation analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortId' => 'required|integer',
            'design_json.comparatorCohortId' => 'required|integer',
            'design_json.outcomeCohortIds' => 'required|array|min:1',
            'design_json.outcomeCohortIds.*' => 'integer',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:cox,logistic,poisson',
            'design_json.model.timeAtRiskStart' => 'nullable|integer',
            'design_json.model.timeAtRiskEnd' => 'nullable|integer',
            'design_json.model.endAnchor' => 'nullable|string',
            'design_json.propensityScore' => 'nullable|array',
            'design_json.propensityScore.enabled' => 'nullable|boolean',
            'design_json.propensityScore.method' => 'nullable|string|in:matching,stratification,iptw',
            'design_json.propensityScore.trimming' => 'nullable|numeric|min:0|max:0.5',
            'design_json.propensityScore.matching' => 'nullable|array',
            'design_json.propensityScore.matching.ratio' => 'nullable|integer|min:1|max:100',
            'design_json.propensityScore.matching.caliper' => 'nullable|numeric|min:0',
            'design_json.propensityScore.matching.caliperScale' => 'nullable|string|in:ps,standardized,standardized_logit',
            'design_json.propensityScore.stratification' => 'nullable|array',
            'design_json.propensityScore.stratification.numStrata' => 'nullable|integer|min:2|max:20',
            'design_json.propensityScore.iptw' => 'nullable|array',
            'design_json.covariateSettings' => 'nullable|array',
            'design_json.negativeControlOutcomes' => 'nullable|array',
            'design_json.negativeControlOutcomes.*' => 'integer',
            'design_json.studyPeriod' => 'nullable|array',
            'design_json.studyPeriod.startDate' => 'nullable|date',
            'design_json.studyPeriod.endDate' => 'nullable|date',
        ]);

        try {
            $analysis = EstimationAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'Estimation analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create estimation analysis', $e);
        }
    }

    /**
     * GET /v1/estimations/{estimation}
     *
     * Show an estimation analysis with its executions.
     */
    public function show(EstimationAnalysis $estimation): JsonResponse
    {
        try {
            $estimation->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $estimation,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve estimation analysis', $e);
        }
    }

    /**
     * PUT /v1/estimations/{estimation}
     *
     * Update an estimation analysis.
     */
    public function update(Request $request, EstimationAnalysis $estimation): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortId' => 'required_with:design_json|integer',
            'design_json.comparatorCohortId' => 'required_with:design_json|integer',
            'design_json.outcomeCohortIds' => 'required_with:design_json|array|min:1',
            'design_json.outcomeCohortIds.*' => 'integer',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:cox,logistic,poisson',
            'design_json.model.timeAtRiskStart' => 'nullable|integer',
            'design_json.model.timeAtRiskEnd' => 'nullable|integer',
            'design_json.model.endAnchor' => 'nullable|string',
            'design_json.propensityScore' => 'nullable|array',
            'design_json.propensityScore.enabled' => 'nullable|boolean',
            'design_json.propensityScore.method' => 'nullable|string|in:matching,stratification,iptw',
            'design_json.propensityScore.trimming' => 'nullable|numeric|min:0|max:0.5',
            'design_json.propensityScore.matching' => 'nullable|array',
            'design_json.propensityScore.matching.ratio' => 'nullable|integer|min:1|max:100',
            'design_json.propensityScore.matching.caliper' => 'nullable|numeric|min:0',
            'design_json.propensityScore.matching.caliperScale' => 'nullable|string|in:ps,standardized,standardized_logit',
            'design_json.propensityScore.stratification' => 'nullable|array',
            'design_json.propensityScore.stratification.numStrata' => 'nullable|integer|min:2|max:20',
            'design_json.propensityScore.iptw' => 'nullable|array',
            'design_json.covariateSettings' => 'nullable|array',
            'design_json.negativeControlOutcomes' => 'nullable|array',
            'design_json.negativeControlOutcomes.*' => 'integer',
            'design_json.studyPeriod' => 'nullable|array',
            'design_json.studyPeriod.startDate' => 'nullable|date',
            'design_json.studyPeriod.endDate' => 'nullable|date',
        ]);

        try {
            $estimation->update($validated);

            return response()->json([
                'data' => $estimation->fresh('author:id,name,email'),
                'message' => 'Estimation analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update estimation analysis', $e);
        }
    }

    /**
     * DELETE /v1/estimations/{estimation}
     *
     * Soft delete an estimation analysis.
     */
    public function destroy(EstimationAnalysis $estimation): JsonResponse
    {
        try {
            $estimation->delete();

            return response()->json([
                'message' => 'Estimation analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete estimation analysis', $e);
        }
    }

    /**
     * POST /v1/estimations/{estimation}/execute
     *
     * Dispatch an estimation execution job.
     */
    public function execute(Request $request, EstimationAnalysis $estimation): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => EstimationAnalysis::class,
                'analysis_id' => $estimation->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunEstimationJob::dispatch($estimation, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Estimation execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue estimation execution', $e);
        }
    }

    /**
     * GET /v1/estimations/{estimation}/executions
     *
     * List all executions for an estimation analysis.
     */
    public function executions(EstimationAnalysis $estimation): JsonResponse
    {
        try {
            $executions = $estimation->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/estimations/{estimation}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        EstimationAnalysis $estimation,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $estimation->id
            || $execution->analysis_type !== EstimationAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this estimation analysis.'], 404);
        }

        try {
            $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($q) => $q->orderBy('created_at'),
            ]);

            if (is_array($execution->result_json)) {
                $execution->result_json = EstimationResultNormalizer::normalize($execution->result_json);
            }

            return response()->json([
                'data' => $execution,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve execution', $e);
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
