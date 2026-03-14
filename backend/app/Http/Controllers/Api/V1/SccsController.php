<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunSccsJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Support\SccsResultNormalizer;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('SCCS', weight: 110)]
class SccsController extends Controller
{
    /**
     * GET /v1/sccs
     *
     * List all SCCS analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = SccsAnalysis::with(['author:id,name,email'])
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
            $analyses->getCollection()->transform(function (SccsAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at']);

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve SCCS analyses', $e);
        }
    }

    /**
     * POST /v1/sccs
     *
     * Create a new SCCS analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.exposureCohortId' => 'required|integer',
            'design_json.outcomeCohortId' => 'required|integer',
            'design_json.riskWindows' => 'nullable|array',
            'design_json.riskWindows.*.start' => 'nullable|integer',
            'design_json.riskWindows.*.end' => 'nullable|integer',
            'design_json.riskWindows.*.startAnchor' => 'nullable|string|in:era_start,era_end',
            'design_json.riskWindows.*.endAnchor' => 'nullable|string|in:era_start,era_end',
            'design_json.riskWindows.*.label' => 'nullable|string|max:255',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:simple,age_adjusted,season_adjusted,age_season_adjusted',
            'design_json.studyPopulation' => 'nullable|array',
            'design_json.studyPopulation.naivePeriod' => 'nullable|integer|min:0',
            'design_json.studyPopulation.firstOutcomeOnly' => 'nullable|boolean',
            'design_json.studyPopulation.minAge' => 'nullable|integer|min:0',
            'design_json.studyPopulation.maxAge' => 'nullable|integer|min:0',
            'design_json.covariateSettings' => 'nullable|array',
        ]);

        try {
            $analysis = SccsAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'SCCS analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create SCCS analysis', $e);
        }
    }

    /**
     * GET /v1/sccs/{sccs}
     *
     * Show an SCCS analysis with its executions.
     */
    public function show(SccsAnalysis $scc): JsonResponse
    {
        try {
            $scc->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $scc,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve SCCS analysis', $e);
        }
    }

    /**
     * PUT /v1/sccs/{sccs}
     *
     * Update an SCCS analysis.
     */
    public function update(Request $request, SccsAnalysis $scc): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.exposureCohortId' => 'required_with:design_json|integer',
            'design_json.outcomeCohortId' => 'required_with:design_json|integer',
            'design_json.riskWindows' => 'nullable|array',
            'design_json.riskWindows.*.start' => 'nullable|integer',
            'design_json.riskWindows.*.end' => 'nullable|integer',
            'design_json.riskWindows.*.startAnchor' => 'nullable|string|in:era_start,era_end',
            'design_json.riskWindows.*.endAnchor' => 'nullable|string|in:era_start,era_end',
            'design_json.riskWindows.*.label' => 'nullable|string|max:255',
            'design_json.model' => 'nullable|array',
            'design_json.model.type' => 'nullable|string|in:simple,age_adjusted,season_adjusted,age_season_adjusted',
            'design_json.studyPopulation' => 'nullable|array',
            'design_json.studyPopulation.naivePeriod' => 'nullable|integer|min:0',
            'design_json.studyPopulation.firstOutcomeOnly' => 'nullable|boolean',
            'design_json.studyPopulation.minAge' => 'nullable|integer|min:0',
            'design_json.studyPopulation.maxAge' => 'nullable|integer|min:0',
            'design_json.covariateSettings' => 'nullable|array',
        ]);

        try {
            $scc->update($validated);

            return response()->json([
                'data' => $scc->fresh('author:id,name,email'),
                'message' => 'SCCS analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update SCCS analysis', $e);
        }
    }

    /**
     * DELETE /v1/sccs/{sccs}
     *
     * Soft delete an SCCS analysis.
     */
    public function destroy(SccsAnalysis $scc): JsonResponse
    {
        try {
            $scc->delete();

            return response()->json([
                'message' => 'SCCS analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete SCCS analysis', $e);
        }
    }

    /**
     * POST /v1/sccs/{sccs}/execute
     *
     * Dispatch an SCCS execution job.
     */
    public function execute(Request $request, SccsAnalysis $scc): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => SccsAnalysis::class,
                'analysis_id' => $scc->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunSccsJob::dispatch($scc, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'SCCS execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue SCCS execution', $e);
        }
    }

    /**
     * GET /v1/sccs/{sccs}/executions
     *
     * List all executions for an SCCS analysis.
     */
    public function executions(SccsAnalysis $scc): JsonResponse
    {
        try {
            $executions = $scc->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/sccs/{sccs}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        SccsAnalysis $scc,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $scc->id
            || $execution->analysis_type !== SccsAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this SCCS analysis.'], 404);
        }

        try {
            $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($q) => $q->orderBy('created_at'),
            ]);

            if (is_array($execution->result_json)) {
                $execution->result_json = SccsResultNormalizer::normalize($execution->result_json);
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
