<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunPredictionJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\PredictionAnalysis;
use App\Models\App\Source;
use App\Support\PredictionResultNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Patient-Level Prediction
 */
class PredictionController extends Controller
{
    /**
     * GET /v1/predictions
     *
     * List all prediction analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = PredictionAnalysis::with(['author:id,name,email'])
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
            $analyses->getCollection()->transform(function (PredictionAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at', 'result_json']);

                if ($latestExecution && is_array($latestExecution->result_json)) {
                    $latestExecution->result_json = PredictionResultNormalizer::normalize($latestExecution->result_json);
                }

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve prediction analyses', $e);
        }
    }

    /**
     * POST /v1/predictions
     *
     * Create a new prediction analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortId' => 'required|integer',
            'design_json.outcomeCohortId' => 'required|integer',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:lasso_logistic_regression,gradient_boosting,random_forest,ada_boost,decision_tree,naive_bayes,mlp,lightgbm,cox_model',
            'design_json.model.hyperParameters' => 'nullable|array',
            'design_json.timeAtRisk' => 'nullable|array',
            'design_json.timeAtRisk.start' => 'nullable|integer',
            'design_json.timeAtRisk.end' => 'nullable|integer',
            'design_json.timeAtRisk.endAnchor' => 'nullable|string',
            'design_json.covariateSettings' => 'nullable|array',
            'design_json.populationSettings' => 'nullable|array',
            'design_json.populationSettings.washoutPeriod' => 'nullable|integer',
            'design_json.populationSettings.removeSubjectsWithPriorOutcome' => 'nullable|boolean',
            'design_json.populationSettings.requireTimeAtRisk' => 'nullable|boolean',
            'design_json.populationSettings.minTimeAtRisk' => 'nullable|integer',
            'design_json.populationSettings.firstExposureOnly' => 'nullable|boolean',
            'design_json.splitSettings' => 'nullable|array',
            'design_json.splitSettings.testFraction' => 'nullable|numeric|min:0|max:1',
            'design_json.splitSettings.splitSeed' => 'nullable|integer',
            'design_json.splitSettings.nFold' => 'nullable|integer|min:2|max:10',
            'design_json.splitSettings.type' => 'nullable|string|in:stratified,time',
            'design_json.preprocessSettings' => 'nullable|array',
            'design_json.preprocessSettings.minFraction' => 'nullable|numeric|min:0|max:1',
            'design_json.preprocessSettings.normalize' => 'nullable|boolean',
            'design_json.preprocessSettings.removeRedundancy' => 'nullable|boolean',
        ]);

        try {
            $analysis = PredictionAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'Prediction analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create prediction analysis', $e);
        }
    }

    /**
     * GET /v1/predictions/{prediction}
     *
     * Show a prediction analysis with its executions.
     */
    public function show(PredictionAnalysis $prediction): JsonResponse
    {
        try {
            $prediction->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $prediction,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve prediction analysis', $e);
        }
    }

    /**
     * PUT /v1/predictions/{prediction}
     *
     * Update a prediction analysis.
     */
    public function update(Request $request, PredictionAnalysis $prediction): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortId' => 'required_with:design_json|integer',
            'design_json.outcomeCohortId' => 'required_with:design_json|integer',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:lasso_logistic_regression,gradient_boosting,random_forest,ada_boost,decision_tree,naive_bayes,mlp,lightgbm,cox_model',
            'design_json.model.hyperParameters' => 'nullable|array',
            'design_json.timeAtRisk' => 'nullable|array',
            'design_json.timeAtRisk.start' => 'nullable|integer',
            'design_json.timeAtRisk.end' => 'nullable|integer',
            'design_json.timeAtRisk.endAnchor' => 'nullable|string',
            'design_json.covariateSettings' => 'nullable|array',
            'design_json.populationSettings' => 'nullable|array',
            'design_json.populationSettings.washoutPeriod' => 'nullable|integer',
            'design_json.populationSettings.removeSubjectsWithPriorOutcome' => 'nullable|boolean',
            'design_json.populationSettings.requireTimeAtRisk' => 'nullable|boolean',
            'design_json.populationSettings.minTimeAtRisk' => 'nullable|integer',
            'design_json.populationSettings.firstExposureOnly' => 'nullable|boolean',
            'design_json.splitSettings' => 'nullable|array',
            'design_json.splitSettings.testFraction' => 'nullable|numeric|min:0|max:1',
            'design_json.splitSettings.splitSeed' => 'nullable|integer',
            'design_json.splitSettings.nFold' => 'nullable|integer|min:2|max:10',
            'design_json.splitSettings.type' => 'nullable|string|in:stratified,time',
            'design_json.preprocessSettings' => 'nullable|array',
            'design_json.preprocessSettings.minFraction' => 'nullable|numeric|min:0|max:1',
            'design_json.preprocessSettings.normalize' => 'nullable|boolean',
            'design_json.preprocessSettings.removeRedundancy' => 'nullable|boolean',
        ]);

        try {
            $prediction->update($validated);

            return response()->json([
                'data' => $prediction->fresh('author:id,name,email'),
                'message' => 'Prediction analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update prediction analysis', $e);
        }
    }

    /**
     * DELETE /v1/predictions/{prediction}
     *
     * Soft delete a prediction analysis.
     */
    public function destroy(PredictionAnalysis $prediction): JsonResponse
    {
        try {
            $prediction->delete();

            return response()->json([
                'message' => 'Prediction analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete prediction analysis', $e);
        }
    }

    /**
     * POST /v1/predictions/{prediction}/execute
     *
     * Dispatch a prediction execution job.
     */
    public function execute(Request $request, PredictionAnalysis $prediction): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => PredictionAnalysis::class,
                'analysis_id' => $prediction->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunPredictionJob::dispatch($prediction, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Prediction execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue prediction execution', $e);
        }
    }

    /**
     * GET /v1/predictions/{prediction}/executions
     *
     * List all executions for a prediction analysis.
     */
    public function executions(PredictionAnalysis $prediction): JsonResponse
    {
        try {
            $executions = $prediction->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/predictions/{prediction}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        PredictionAnalysis $prediction,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $prediction->id
            || $execution->analysis_type !== PredictionAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this prediction analysis.'], 404);
        }

        try {
            $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($q) => $q->orderBy('created_at'),
            ]);

            if (is_array($execution->result_json)) {
                $execution->result_json = PredictionResultNormalizer::normalize($execution->result_json);
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
