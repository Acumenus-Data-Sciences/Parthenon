<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AnalysisType;
use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Jobs\Analysis\RunCharacterizationJob;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\Source;
use App\Services\Analysis\CharacterizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CharacterizationController extends Controller
{
    public function __construct(
        private readonly CharacterizationService $characterizationService,
    ) {}

    /**
     * GET /v1/characterizations
     *
     * List all characterizations (paginated), with latest execution status.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Characterization::with(['author:id,name,email'])
                ->orderByDesc('updated_at');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            }

            $characterizations = $query->paginate($request->integer('per_page', 20));

            // Append latest execution info to each characterization
            $characterizations->getCollection()->transform(function (Characterization $char) {
                $latestExecution = $char->executions()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'source_id', 'started_at', 'completed_at']);

                $char->setAttribute('latest_execution', $latestExecution);

                return $char;
            });

            return response()->json($characterizations);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve characterizations', $e);
        }
    }

    /**
     * POST /v1/characterizations
     *
     * Create a new characterization.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortIds' => 'required|array|min:1',
            'design_json.targetCohortIds.*' => 'integer',
            'design_json.comparatorCohortIds' => 'nullable|array',
            'design_json.comparatorCohortIds.*' => 'integer',
            'design_json.featureTypes' => 'nullable|array',
            'design_json.featureTypes.*' => 'string',
            'design_json.stratifyByGender' => 'nullable|boolean',
            'design_json.stratifyByAge' => 'nullable|boolean',
            'design_json.topN' => 'nullable|integer|min:1|max:1000',
            'design_json.minCellCount' => 'nullable|integer|min:1',
        ]);

        try {
            $characterization = Characterization::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'design_json' => $validated['design_json'],
                'author_id' => $request->user()->id,
            ]);

            $characterization->load('author:id,name,email');

            return response()->json([
                'data' => $characterization,
                'message' => 'Characterization created.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create characterization', $e);
        }
    }

    /**
     * GET /v1/characterizations/{characterization}
     *
     * Show a characterization with its executions.
     */
    public function show(Characterization $characterization): JsonResponse
    {
        try {
            $characterization->load([
                'author:id,name,email',
                'executions' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'executions.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $characterization,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve characterization', $e);
        }
    }

    /**
     * PUT /v1/characterizations/{characterization}
     *
     * Update a characterization.
     */
    public function update(Request $request, Characterization $characterization): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'sometimes|required|array',
            'design_json.targetCohortIds' => 'required_with:design_json|array|min:1',
            'design_json.targetCohortIds.*' => 'integer',
            'design_json.comparatorCohortIds' => 'nullable|array',
            'design_json.comparatorCohortIds.*' => 'integer',
            'design_json.featureTypes' => 'nullable|array',
            'design_json.featureTypes.*' => 'string',
            'design_json.stratifyByGender' => 'nullable|boolean',
            'design_json.stratifyByAge' => 'nullable|boolean',
            'design_json.topN' => 'nullable|integer|min:1|max:1000',
            'design_json.minCellCount' => 'nullable|integer|min:1',
        ]);

        try {
            $characterization->update($validated);

            return response()->json([
                'data' => $characterization->fresh('author:id,name,email'),
                'message' => 'Characterization updated.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update characterization', $e);
        }
    }

    /**
     * DELETE /v1/characterizations/{characterization}
     *
     * Soft delete a characterization.
     */
    public function destroy(Characterization $characterization): JsonResponse
    {
        try {
            $characterization->delete();

            return response()->json([
                'message' => 'Characterization deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete characterization', $e);
        }
    }

    /**
     * POST /v1/characterizations/{characterization}/execute
     *
     * Dispatch a characterization execution job.
     */
    public function execute(Request $request, Characterization $characterization): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create execution record
            $execution = AnalysisExecution::create([
                'analysis_type' => Characterization::class,
                'analysis_id' => $characterization->id,
                'source_id' => $source->id,
                'status' => ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            RunCharacterizationJob::dispatch($characterization, $source, $execution);

            return response()->json([
                'data' => $execution,
                'message' => 'Characterization execution queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue characterization execution', $e);
        }
    }

    /**
     * GET /v1/characterizations/{characterization}/executions
     *
     * List all executions for a characterization.
     */
    public function executions(Characterization $characterization): JsonResponse
    {
        try {
            $executions = $characterization->executions()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($executions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve executions', $e);
        }
    }

    /**
     * GET /v1/characterizations/{characterization}/executions/{execution}
     *
     * Show a specific execution with result_json.
     */
    public function showExecution(
        Characterization $characterization,
        AnalysisExecution $execution,
    ): JsonResponse {
        if ((int) $execution->analysis_id !== (int) $characterization->id
            || $execution->analysis_type !== Characterization::class
        ) {
            return response()->json(['message' => 'Execution does not belong to this characterization.'], 404);
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
