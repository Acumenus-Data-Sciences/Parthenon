<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\Cohort\GenerateCohortJob;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use App\Services\Analysis\CohortDiagnosticsService;
use App\Services\Analysis\CohortOverlapService;
use App\Services\Cohort\CohortGenerationService;
use App\Services\Cohort\CohortSqlCompiler;
use App\Services\Cohort\Schema\CohortExpressionSchema;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

#[Group('Cohort Definitions', weight: 50)]
class CohortDefinitionController extends Controller
{
    public function __construct(
        private readonly CohortSqlCompiler $compiler,
        private readonly CohortGenerationService $generationService,
        private readonly CohortExpressionSchema $schema,
        private readonly CohortOverlapService $overlapService,
        private readonly CohortDiagnosticsService $diagnosticsService,
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

            // Optional tag filter (?tags[]=cardiology&tags[]=diabetes)
            if ($request->filled('tags')) {
                $tags = (array) $request->input('tags');
                foreach ($tags as $tag) {
                    $query->whereRaw('tags @> ?::jsonb', [json_encode([$tag])]);
                }
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
            'tags' => 'sometimes|array',
            'tags.*' => 'string|max:50',
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
     * POST /v1/cohort-definitions/import
     *
     * Import one or more Atlas-format cohort definitions.
     * Accepts: {name, description, expression} or [{...}, ...]
     */
    public function import(Request $request): JsonResponse
    {
        $payload = $request->json()->all();

        // Normalize to array of items
        $items = isset($payload['name']) ? [$payload] : array_values($payload);

        if (empty($items)) {
            return response()->json(['error' => 'No cohort definitions provided'], 422);
        }

        $imported = 0;
        $skipped = 0;
        $failed = 0;
        $results = [];

        foreach ($items as $item) {
            $name = trim($item['name'] ?? '');
            $description = $item['description'] ?? null;
            $expression = $item['expression'] ?? $item['expression_json'] ?? null;

            if (! $name || ! $expression) {
                $failed++;
                $results[] = ['name' => $name ?: '(unknown)', 'status' => 'failed', 'reason' => 'Missing name or expression'];

                continue;
            }

            // Duplicate check (case-insensitive)
            $exists = CohortDefinition::whereRaw('lower(name) = ?', [strtolower($name)])->exists();
            if ($exists) {
                $skipped++;
                $results[] = ['name' => $name, 'status' => 'skipped', 'reason' => 'Duplicate name'];

                continue;
            }

            try {
                $this->schema->validate($expression);

                $def = CohortDefinition::create([
                    'name' => $name,
                    'description' => $description,
                    'expression_json' => $expression,
                    'author_id' => $request->user()->id,
                ]);

                $imported++;
                $results[] = ['name' => $name, 'status' => 'imported', 'id' => $def->id];
            } catch (\Throwable $e) {
                $failed++;
                $results[] = ['name' => $name, 'status' => 'failed', 'reason' => $e->getMessage()];
            }
        }

        return response()->json([
            'imported' => $imported,
            'skipped' => $skipped,
            'failed' => $failed,
            'results' => $results,
        ], 201);
    }

    /**
     * GET /v1/cohort-definitions/{cohortDefinition}/export
     *
     * Export a cohort definition in Atlas-compatible format.
     */
    public function export(CohortDefinition $cohortDefinition): JsonResponse
    {
        return response()->json([
            'name' => $cohortDefinition->name,
            'description' => $cohortDefinition->description,
            'expression' => $cohortDefinition->expression_json,
        ]);
    }

    /**
     * GET /v1/cohort-definitions/tags
     *
     * Return distinct tag values across all non-deleted definitions.
     */
    public function tags(): JsonResponse
    {
        try {
            $tags = \DB::select('
                SELECT DISTINCT jsonb_array_elements_text(tags) AS tag
                FROM cohort_definitions
                WHERE deleted_at IS NULL
                  AND tags IS NOT NULL
                ORDER BY tag
            ');

            return response()->json(array_column($tags, 'tag'));
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve tags', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions/{cohortDefinition}/share
     *
     * Generate a read-only share token for a cohort definition.
     */
    public function share(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $days = $request->integer('days', 30);
        $days = max(1, min(365, $days));

        try {
            $token = Str::random(64);
            $expiresAt = now()->addDays($days);

            $cohortDefinition->update([
                'share_token' => $token,
                'share_expires_at' => $expiresAt,
            ]);

            $url = url("/shared/{$token}");

            return response()->json([
                'token' => $token,
                'url' => $url,
                'expires_at' => $expiresAt->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to generate share token', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/shared/{token}
     *
     * Public endpoint — returns definition for a valid, non-expired share token.
     */
    public function showShared(string $token): JsonResponse
    {
        $def = CohortDefinition::where('share_token', $token)
            ->whereNotNull('share_expires_at')
            ->where('share_expires_at', '>', now())
            ->first(['id', 'name', 'description', 'expression_json', 'share_expires_at']);

        if (! $def) {
            return response()->json(['error' => 'Not found or expired'], 404);
        }

        return response()->json([
            'id' => $def->id,
            'name' => $def->name,
            'description' => $def->description,
            'expression' => $def->expression_json,
            'expires_at' => $def->share_expires_at->toIso8601String(),
        ]);
    }

    /**
     * POST /v1/cohort-definitions/{cohortDefinition}/diagnostics
     *
     * Run SQL-based cohort diagnostics (counts, visit context, time distributions, age).
     */
    public function diagnostics(Request $request, CohortDefinition $cohortDefinition): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $result = $this->diagnosticsService->run($cohortDefinition, $source);

            return response()->json(['data' => $result]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to run cohort diagnostics', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions/compare
     *
     * Compute pairwise overlap between 2-4 generated cohorts.
     */
    public function compare(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'cohort_ids' => 'required|array|min:2|max:4',
            'cohort_ids.*' => 'integer',
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        try {
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $result = $this->overlapService->computeOverlap(
                $validated['cohort_ids'],
                $source,
            );

            return response()->json(['data' => $result]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to compute cohort overlap', $e);
        }
    }

    /**
     * GET /v1/cohort-definitions/stats
     *
     * Quick aggregate stats for cohort definitions.
     */
    public function stats(): JsonResponse
    {
        try {
            return response()->json([
                'total' => CohortDefinition::count(),
                'with_generations' => CohortDefinition::whereHas('generations', fn ($q) => $q->where('status', 'completed'))->count(),
                'public' => CohortDefinition::where('is_public', true)->count(),
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve stats', $e);
        }
    }

    /**
     * POST /v1/cohort-definitions/from-bundle
     *
     * Create a cohort definition from a Care Gap condition bundle.
     * Builds concept sets and criteria from the bundle's condition concepts
     * and quality measure criteria.
     */
    public function createFromBundle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bundle_id' => 'required|integer|exists:condition_bundles,id',
            'include_measures' => 'boolean',
            'name' => 'nullable|string|max:255',
        ]);

        try {
            $bundle = ConditionBundle::with('measures')->findOrFail($validated['bundle_id']);
            $includeMeasures = $validated['include_measures'] ?? true;
            $name = $validated['name'] ?? "{$bundle->condition_name} Cohort";

            // Build concept sets
            $conceptSets = [];
            $conceptSetIndex = 0;

            // ConceptSet 0: Primary condition concepts from bundle
            $conditionItems = collect($bundle->omop_concept_ids)->map(fn (int $id) => [
                'concept' => [
                    'CONCEPT_ID' => $id,
                    'CONCEPT_NAME' => $bundle->condition_name,
                    'DOMAIN_ID' => 'Condition',
                    'VOCABULARY_ID' => 'SNOMED',
                    'CONCEPT_CLASS_ID' => 'Clinical Finding',
                    'STANDARD_CONCEPT' => 'S',
                    'CONCEPT_CODE' => '',
                ],
                'isExcluded' => false,
                'includeDescendants' => true,
                'includeMapped' => false,
            ])->values()->all();

            $conceptSets[] = [
                'id' => $conceptSetIndex,
                'name' => "{$bundle->condition_name} Conditions",
                'expression' => ['items' => $conditionItems],
            ];
            $conceptSetIndex++;

            // Build additional criteria from measures
            $additionalCriteriaList = [];

            if ($includeMeasures && $bundle->measures->isNotEmpty()) {
                foreach ($bundle->measures as $measure) {
                    $conceptIds = $measure->numerator_criteria['concept_ids'] ?? [];
                    if (empty($conceptIds)) {
                        continue;
                    }

                    $domainType = $this->mapMeasureDomainToCriterionType($measure->domain);
                    if (! $domainType) {
                        continue;
                    }

                    // Build concept set for this measure
                    $measureItems = collect($conceptIds)->map(fn (int $id) => [
                        'concept' => [
                            'CONCEPT_ID' => $id,
                            'CONCEPT_NAME' => $measure->measure_name,
                            'DOMAIN_ID' => $this->mapDomainToOmop($measure->domain),
                            'VOCABULARY_ID' => '',
                            'CONCEPT_CLASS_ID' => '',
                            'STANDARD_CONCEPT' => 'S',
                            'CONCEPT_CODE' => '',
                        ],
                        'isExcluded' => false,
                        'includeDescendants' => true,
                        'includeMapped' => false,
                    ])->values()->all();

                    $conceptSets[] = [
                        'id' => $conceptSetIndex,
                        'name' => $measure->measure_name,
                        'expression' => ['items' => $measureItems],
                    ];

                    $lookbackDays = $measure->numerator_criteria['lookback_days'] ?? 365;

                    $additionalCriteriaList[] = [
                        'Criteria' => [$domainType => ['CodesetId' => $conceptSetIndex]],
                        'StartWindow' => [
                            'Start' => ['Days' => $lookbackDays, 'Coeff' => -1],
                            'End' => ['Days' => $lookbackDays, 'Coeff' => 1],
                        ],
                        'Occurrence' => ['Type' => 2, 'Count' => 1],
                    ];

                    $conceptSetIndex++;
                }
            }

            // Assemble the expression
            $expression = [
                'ConceptSets' => $conceptSets,
                'PrimaryCriteria' => [
                    'CriteriaList' => [
                        ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                    ],
                    'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                ],
                'QualifiedLimit' => ['Type' => 'First'],
                'ExpressionLimit' => ['Type' => 'First'],
                'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
            ];

            if (! empty($additionalCriteriaList)) {
                $expression['AdditionalCriteria'] = [
                    'Type' => 'ALL',
                    'CriteriaList' => $additionalCriteriaList,
                    'Groups' => [],
                ];
            }

            $tags = array_filter([
                strtolower($bundle->bundle_code),
                strtolower($bundle->disease_category ?? ''),
                'from-bundle',
            ]);

            $cohortDef = CohortDefinition::create([
                'name' => $name,
                'description' => "Auto-generated from {$bundle->condition_name} care bundle. Includes primary condition criteria"
                    . ($includeMeasures ? ' and quality measure inclusion rules.' : '.'),
                'expression_json' => $expression,
                'author_id' => $request->user()->id,
                'is_public' => false,
                'tags' => array_values($tags),
            ]);

            $cohortDef->load('author:id,name,email');

            return response()->json([
                'data' => $cohortDef,
                'message' => "Cohort definition created from {$bundle->condition_name} bundle.",
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create cohort from bundle', $e);
        }
    }

    /**
     * Map quality measure domain to OHDSI criterion type.
     */
    private function mapMeasureDomainToCriterionType(string $domain): ?string
    {
        return match ($domain) {
            'measurement' => 'Measurement',
            'drug' => 'DrugExposure',
            'procedure' => 'ProcedureOccurrence',
            'observation' => 'Observation',
            'condition' => 'ConditionOccurrence',
            default => null,
        };
    }

    /**
     * Map quality measure domain to OMOP domain_id.
     */
    private function mapDomainToOmop(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'Measurement',
            'drug' => 'Drug',
            'procedure' => 'Procedure',
            'observation' => 'Observation',
            'condition' => 'Condition',
            default => 'Observation',
        };
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
