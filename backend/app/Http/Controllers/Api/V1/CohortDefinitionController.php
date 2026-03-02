<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\Cohort\GenerateCohortJob;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use App\Services\Cohort\CohortGenerationService;
use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CohortDefinitionController extends Controller
{
    public function __construct(
        private readonly CohortSqlCompiler $compiler,
        private readonly CohortGenerationService $generationService,
        private readonly CohortExpressionSchema $schema,
    ) {}

    /**
     * GET /v1/cohort-definitions
     *
     * List all cohort definitions (paginated), with latest generation info.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = CohortDefinition::withCount('generations')
                ->with(['author:id,name,email'])
                ->orderByDesc('updated_at');

            // Optional search filter
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            }

            $cohortDefinitions = $query->paginate($request->integer('per_page', 20));

            // Append latest generation info to each definition
            $cohortDefinitions->getCollection()->transform(function (CohortDefinition $def) {
                $latestGeneration = $def->generations()
                    ->orderByDesc('created_at')
                    ->first(['id', 'status', 'person_count', 'completed_at', 'source_id']);

                $def->setAttribute('latest_generation', $latestGeneration);

                return $def;
            });

            return response()->json($cohortDefinitions);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve cohort definitions', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions
     *
     * Create a new cohort definition.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'expression_json' => 'required|array',
            'is_public' => 'boolean',
        ]);

        try {
            // Validate the expression structure
            $this->schema->validate($validated['expression_json']);

            $cohortDef = CohortDefinition::create([
                ...$validated,
                'author_id' => $request->user()->id,
            ]);

            $cohortDef->load('author:id,name,email');

            return response()->json([
                'data' => $cohortDef,
                'message' => 'Cohort definition created.',
            ], 201);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid cohort expression',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create cohort definition', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}
     *
     * Show a cohort definition with its generations.
     */
    public function show(CohortDefinition $cohortDefinition): JsonResponse
    {
        try {
            $cohortDefinition->load([
                'author:id,name,email',
                'generations' => fn ($q) => $q->orderByDesc('created_at')->limit(10),
                'generations.source:id,source_name,source_key',
            ]);

            return response()->json([
                'data' => $cohortDefinition,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve cohort definition', $e);
        }
    }

    /**
     * PUT /v1/cohort-definitions/{cohortDefinition}
     *
     * Update a cohort definition.
     */
    public function update(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'expression_json' => 'sometimes|required|array',
            'is_public' => 'boolean',
        ]);

        try {
            // Validate expression if provided
            if (isset($validated['expression_json'])) {
                $this->schema->validate($validated['expression_json']);
                // Increment version when expression changes
                $validated['version'] = $cohortDefinition->version + 1;
            }

            $cohortDefinition->update($validated);

            return response()->json([
                'data' => $cohortDefinition->fresh('author:id,name,email'),
                'message' => 'Cohort definition updated.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid cohort expression',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update cohort definition', $e);
        }
    }

    /**
     * DELETE /v1/cohort-definitions/{cohortDefinition}
     *
     * Soft delete a cohort definition.
     */
    public function destroy(CohortDefinition $cohortDefinition): JsonResponse
    {
        try {
            $cohortDefinition->delete();

            return response()->json([
                'message' => 'Cohort definition deleted.',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete cohort definition', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions/{cohortDefinition}/generate
     *
     * Dispatch a cohort generation job for the given definition and source.
     * Returns 202 Accepted with the generation record.
     */
    public function generate(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Create the generation record in Queued status
            $generation = CohortGeneration::create([
                'cohort_definition_id' => $cohortDefinition->id,
                'source_id' => $source->id,
                'status' => \App\Enums\ExecutionStatus::Queued,
                'started_at' => now(),
            ]);

            // Dispatch the job
            GenerateCohortJob::dispatch($cohortDefinition, $source);

            return response()->json([
                'data' => $generation,
                'message' => 'Cohort generation queued.',
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue cohort generation', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/generations
     *
     * List all generations for a cohort definition.
     */
    public function generations(CohortDefinition $cohortDefinition): JsonResponse
    {
        try {
            $generations = $cohortDefinition->generations()
                ->with('source:id,source_name,source_key')
                ->orderByDesc('created_at')
                ->paginate(20);

            return response()->json($generations);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve generations', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/generations/{generation}
     *
     * Show a specific generation with details.
     */
    public function showGeneration(CohortDefinition $cohortDefinition, CohortGeneration $generation): JsonResponse
    {
        if ($generation->cohort_definition_id !== $cohortDefinition->id) {
            return response()->json(['message' => 'Generation does not belong to this cohort definition.'], 404);
        }

        try {
            $generation->load('source:id,source_name,source_key');

            $response = [
                'data' => $generation,
            ];

            // Include member count breakdown if completed
            if ($generation->status === \App\Enums\ExecutionStatus::Completed) {
                $members = $this->generationService->getMembers($generation, limit: 10);
                $response['data'] = array_merge($generation->toArray(), [
                    'member_preview' => $members['members'],
                    'total_records' => $members['total'],
                ]);
            }

            return response()->json($response);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve generation', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/sql
     *
     * Preview the compiled SQL for a cohort definition without executing it.
     */
    public function previewSql(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        try {
            $sourceId = $request->input('source_id');

            if ($sourceId) {
                $source = Source::with('daimons')->findOrFail($sourceId);
                $sql = $this->generationService->previewSql($cohortDefinition, $source);
            } else {
                // Use placeholder schemas for preview
                $sql = $this->compiler->preview(
                    expression: $cohortDefinition->expression_json,
                    cdmSchema: '{cdm_schema}',
                    vocabSchema: '{vocab_schema}',
                );
            }

            return response()->json([
                'data' => [
                    'cohort_definition_id' => $cohortDefinition->id,
                    'sql' => $sql,
                ],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error' => 'Invalid cohort expression',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to generate SQL preview', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions/{cohortDefinition}/copy
     *
     * Duplicate a cohort definition.
     */
    public function copy(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        try {
            $copy = $cohortDefinition->replicate(['id', 'created_at', 'updated_at', 'deleted_at']);
            $copy->name = "Copy of {$cohortDefinition->name}";
            $copy->author_id = $request->user()->id;
            $copy->version = 1;
            $copy->save();

            $copy->load('author:id,name,email');

            return response()->json([
                'data' => $copy,
                'message' => 'Cohort definition copied.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to copy cohort definition', $e);
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
