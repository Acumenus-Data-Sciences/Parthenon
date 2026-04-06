<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunPathwayJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\PathwayAnalysis;
use App\Models\App\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Treatment Pathways
 */
class PathwayController extends Controller
{
    /**
     * GET /v1/pathways
     *
     * List all pathway analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = PathwayAnalysis::with(['author:id,name,email'])
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
            $analyses->getCollection()->transform(function (PathwayAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at', 'result_json']);

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve pathway analyses', $e);
        }
    }

    /**
     * POST /v1/pathways
     *
     * Create a new pathway analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortId' => 'required|integer',
            'design_json.eventCohortIds' => 'required|array|min:1',
            'design_json.eventCohortIds.*' => 'integer',
            'design_json.maxDepth' => 'nullable|integer|min:1|max:20',
            'design_json.minCellCount' => 'nullable|integer|min:1',
            'design_json.combinationWindow' => 'nullable|integer|min:0',
            'design_json.maxPathLength' => 'nullable|integer|min:1|max:20',
        ]);

        try {
            $analysis = PathwayAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'Pathway analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create pathway analysis', $e);
        }
    }

    /**
     * GET /v1/pathways/{pathway}
     *
     * Show a pathway analysis with its recent executions.
     */
    public function show(PathwayAnalysis $pathway): JsonResponse
    {
        try {
            $pathway->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $pathway,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve pathway analysis', $e);
        }
    }

    /**
     * PUT /v1/pathways/{pathway}
     *
     * Update a pathway analysis.
     */
    public function update(Request $request, PathwayAnalysis $pathway): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortId' => 'required_with:design_json|integer',
            'design_json.eventCohortIds' => 'required_with:design_json|array|min:1',
            'design_json.eventCohortIds.*' => 'integer',
            'design_json.maxDepth' => 'nullable|integer|min:1|max:20',
            'design_json.minCellCount' => 'nullable|integer|min:1',
            'design_json.combinationWindow' => 'nullable|integer|min:0',
            'design_json.maxPathLength' => 'nullable|integer|min:1|max:20',
        ]);

        try {
            $pathway->update($validated);

            return response()->json([
                'data' => $pathway->fresh('author:id,name,email'),
                'message' => 'Pathway analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update pathway analysis', $e);
        }
    }

    /**
     * DELETE /v1/pathways/{pathway}
     *
     * Soft delete a pathway analysis.
     */
    public function destroy(PathwayAnalysis $pathway): JsonResponse
    {
        try {
            $pathway->delete();

            return response()->json([
                'message' => 'Pathway analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete pathway analysis', $e);
        }
    }

    /**
     * POST /v1/pathways/{pathway}/execute
     *
     * Dispatch a pathway analysis execution job.
     */
    public function execute(Request $request, PathwayAnalysis $pathway): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => PathwayAnalysis::class,
                'analysis_id' => $pathway->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunPathwayJob::dispatch($pathway, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Pathway analysis execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue pathway analysis execution', $e);
        }
    }

    /**
     * GET /v1/pathways/{pathway}/executions
     *
     * List all executions for a pathway analysis.
     */
    public function executions(PathwayAnalysis $pathway): JsonResponse
    {
        try {
            $executions = $pathway->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/pathways/{pathway}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        PathwayAnalysis $pathway,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $pathway->id
            || $execution->analysis_type !== PathwayAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this pathway analysis.'], 404);
        }

        try {
            $execution->load([
                'source:id,source_name,source_key',
                'logs' => fn ($q) => $q->orderBy('created_at'),
            ]);

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
