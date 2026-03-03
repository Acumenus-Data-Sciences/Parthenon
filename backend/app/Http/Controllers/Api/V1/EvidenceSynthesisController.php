<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunEvidenceSynthesisJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\EvidenceSynthesisAnalysis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvidenceSynthesisController extends Controller
{
    /**
     * GET /v1/evidence-synthesis
     *
     * List all evidence synthesis analyses (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = EvidenceSynthesisAnalysis::with(['author:id,name,email'])
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
            $analyses->getCollection()->transform(function (EvidenceSynthesisAnalysis $analysis) {
                $latestExecution = $analysis->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'started_at', 'completed_at']);

                $analysis->setAttribute('latest_execution', $latestExecution);

                return $analysis;
            });

            return response()->json($analyses);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve evidence synthesis analyses', $e);
        }
    }

    /**
     * POST /v1/evidence-synthesis
     *
     * Create a new evidence synthesis analysis.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.estimates' => 'required|array|min:2',
            'design_json.estimates.*.logRr' => 'required|numeric',
            'design_json.estimates.*.seLogRr' => 'required|numeric|min:0',
            'design_json.estimates.*.siteName' => 'nullable|string|max:255',
            'design_json.method' => 'nullable|string|in:bayesian,fixed',
            'design_json.chainLength' => 'nullable|integer|min:10000',
            'design_json.burnIn' => 'nullable|integer|min:1000',
            'design_json.subSample' => 'nullable|integer|min:1',
        ]);

        try {
            $analysis = EvidenceSynthesisAnalysis::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $analysis->load('author:id,name,email');

            return response()->json([
                'data' => $analysis,
                'message' => 'Evidence synthesis analysis created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create evidence synthesis analysis', $e);
        }
    }

    /**
     * GET /v1/evidence-synthesis/{evidenceSynthesis}
     *
     * Show an evidence synthesis analysis with its executions.
     */
    public function show(EvidenceSynthesisAnalysis $evidenceSynthesis): JsonResponse
    {
        try {
            $evidenceSynthesis->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
            ]);

            return response()->json([
                'data' => $evidenceSynthesis,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve evidence synthesis analysis', $e);
        }
    }

    /**
     * PUT /v1/evidence-synthesis/{evidenceSynthesis}
     *
     * Update an evidence synthesis analysis.
     */
    public function update(Request $request, EvidenceSynthesisAnalysis $evidenceSynthesis): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.estimates' => 'required_with:design_json|array|min:2',
            'design_json.estimates.*.logRr' => 'required_with:design_json.estimates|numeric',
            'design_json.estimates.*.seLogRr' => 'required_with:design_json.estimates|numeric|min:0',
            'design_json.estimates.*.siteName' => 'nullable|string|max:255',
            'design_json.method' => 'nullable|string|in:bayesian,fixed',
            'design_json.chainLength' => 'nullable|integer|min:10000',
            'design_json.burnIn' => 'nullable|integer|min:1000',
            'design_json.subSample' => 'nullable|integer|min:1',
        ]);

        try {
            $evidenceSynthesis->update($validated);

            return response()->json([
                'data' => $evidenceSynthesis->fresh('author:id,name,email'),
                'message' => 'Evidence synthesis analysis updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update evidence synthesis analysis', $e);
        }
    }

    /**
     * DELETE /v1/evidence-synthesis/{evidenceSynthesis}
     *
     * Soft delete an evidence synthesis analysis.
     */
    public function destroy(EvidenceSynthesisAnalysis $evidenceSynthesis): JsonResponse
    {
        try {
            $evidenceSynthesis->delete();

            return response()->json([
                'message' => 'Evidence synthesis analysis deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete evidence synthesis analysis', $e);
        }
    }

    /**
     * POST /v1/evidence-synthesis/{evidenceSynthesis}/execute
     *
     * Dispatch an evidence synthesis execution job.
     * Note: No source_id needed — ES operates on pre-collected estimates.
     */
    public function execute(EvidenceSynthesisAnalysis $evidenceSynthesis): JsonResponse
    {
        try {
            // Create execution record (no source — meta-analysis of existing estimates)
            $execution = AnalysisExecution::create([
                'analysis_type' => EvidenceSynthesisAnalysis::class,
                'analysis_id' => $evidenceSynthesis->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunEvidenceSynthesisJob::dispatch($evidenceSynthesis, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Evidence synthesis execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue evidence synthesis execution', $e);
        }
    }

    /**
     * GET /v1/evidence-synthesis/{evidenceSynthesis}/executions
     *
     * List all executions for an evidence synthesis analysis.
     */
    public function executions(EvidenceSynthesisAnalysis $evidenceSynthesis): JsonResponse
    {
        try {
            $executions = $evidenceSynthesis->executions()
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/evidence-synthesis/{evidenceSynthesis}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        EvidenceSynthesisAnalysis $evidenceSynthesis,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $evidenceSynthesis->id
            || $execution->analysis_type !== EvidenceSynthesisAnalysis::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this evidence synthesis analysis.'], 404);
        }

        try {
            $execution->load([
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
