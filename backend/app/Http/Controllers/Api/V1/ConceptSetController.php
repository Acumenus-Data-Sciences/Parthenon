<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\ConditionBundle;
use App\Models\Vocabulary\Concept;
use App\Services\ConceptSet\ConceptSetResolverService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

#[Group('Concept Sets', weight: 40)]
class ConceptSetController extends Controller
{
    public function __construct(
        private readonly ConceptSetResolverService $resolver,
    ) {}

    /**
     * GET /v1/concept-sets
     *
     * List all concept sets (paginated), with items count.
     * Supports ?search= and ?tags[]= filters.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = ConceptSet::withCount('items')
                ->with(['author:id,name,email'])
                ->orderByDesc('updated_at');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            }

            if ($request->filled('tags')) {
                $tags = (array) $request->input('tags');
                foreach ($tags as $tag) {
                    $query->whereRaw('tags @> ?::jsonb', [json_encode([$tag])]);
                }
            }

            return response()->json($query->paginate($request->integer('per_page', 20)));
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve concept sets', $e);
        }
    }

    /**
     * GET /v1/concept-sets/stats
     *
     * Aggregate stats for concept sets.
     */
    public function stats(): JsonResponse
    {
        return response()->json([
            'total' => ConceptSet::count(),
            'with_items' => ConceptSet::whereHas('items')->count(),
            'public' => ConceptSet::where('is_public', true)->count(),
        ]);
    }

    /**
     * GET /v1/concept-sets/tags
     *
     * Distinct tags across all concept sets.
     */
    public function tags(): JsonResponse
    {
        $tags = DB::select('
            SELECT DISTINCT jsonb_array_elements_text(tags) AS tag
            FROM concept_sets
            WHERE deleted_at IS NULL AND tags IS NOT NULL
            ORDER BY tag
        ');

        return response()->json(array_column($tags, 'tag'));
    }

    /**
     * POST /v1/concept-sets
     *
     * Create a new concept set.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:100',
        ]);

        try {
            $conceptSet = ConceptSet::create([
                ...$validated,
                'author_id' => $request->user()->id,
            ]);

            $conceptSet->loadCount('items');

            return response()->json([
                'data' => $conceptSet,
                'message' => 'Concept set created',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create concept set', $e);
        }
    }

    /**
     * GET /v1/concept-sets/{conceptSet}
     *
     * Show a concept set with items enriched with vocabulary concept details.
     */
    public function show(ConceptSet $conceptSet): JsonResponse
    {
        try {
            $conceptSet->load('items', 'author');

            // Enrich items with concept details from the vocabulary database
            $conceptIds = $conceptSet->items->pluck('concept_id')->unique()->all();

            $concepts = [];
            if (! empty($conceptIds)) {
                $concepts = Concept::whereIn('concept_id', $conceptIds)
                    ->get([
                        'concept_id',
                        'concept_name',
                        'domain_id',
                        'vocabulary_id',
                        'concept_class_id',
                        'standard_concept',
                        'concept_code',
                    ])
                    ->keyBy('concept_id');
            }

            $items = $conceptSet->items->map(function (ConceptSetItem $item) use ($concepts) {
                $concept = $concepts[$item->concept_id] ?? null;

                return [
                    'id' => $item->id,
                    'concept_set_id' => $item->concept_set_id,
                    'concept_id' => $item->concept_id,
                    'is_excluded' => $item->is_excluded,
                    'include_descendants' => $item->include_descendants,
                    'include_mapped' => $item->include_mapped,
                    'concept' => $concept ? [
                        'concept_id' => $concept->concept_id,
                        'concept_name' => $concept->concept_name,
                        'domain_id' => $concept->domain_id,
                        'vocabulary_id' => $concept->vocabulary_id,
                        'concept_class_id' => $concept->concept_class_id,
                        'standard_concept' => $concept->standard_concept,
                        'concept_code' => $concept->concept_code,
                    ] : null,
                ];
            });

            return response()->json([
                'data' => [
                    'id' => $conceptSet->id,
                    'name' => $conceptSet->name,
                    'description' => $conceptSet->description,
                    'expression_json' => $conceptSet->expression_json,
                    'author' => $conceptSet->author,
                    'is_public' => $conceptSet->is_public,
                    'tags' => $conceptSet->tags,
                    'created_at' => $conceptSet->created_at,
                    'updated_at' => $conceptSet->updated_at,
                    'items' => $items,
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve concept set', $e);
        }
    }

    /**
     * PUT /v1/concept-sets/{conceptSet}
     *
     * Update concept set metadata.
     */
    public function update(Request $request, ConceptSet $conceptSet): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'boolean',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:100',
        ]);

        try {
            $conceptSet->update($validated);

            return response()->json([
                'data' => $conceptSet->fresh(),
                'message' => 'Concept set updated',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update concept set', $e);
        }
    }

    /**
     * DELETE /v1/concept-sets/{conceptSet}
     *
     * Soft delete a concept set.
     */
    public function destroy(ConceptSet $conceptSet): JsonResponse
    {
        try {
            $conceptSet->delete();

            return response()->json([
                'message' => 'Concept set deleted',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to delete concept set', $e);
        }
    }

    /**
     * POST /v1/concept-sets/{conceptSet}/copy
     *
     * Duplicate a concept set with all items.
     */
    public function copy(Request $request, ConceptSet $conceptSet): JsonResponse
    {
        try {
            $copy = $conceptSet->replicate(['id', 'created_at', 'updated_at', 'deleted_at']);
            $copy->name = "Copy of {$conceptSet->name}";
            $copy->author_id = $request->user()->id;
            $copy->save();

            foreach ($conceptSet->items as $item) {
                $copy->items()->create([
                    'concept_id' => $item->concept_id,
                    'is_excluded' => $item->is_excluded,
                    'include_descendants' => $item->include_descendants,
                    'include_mapped' => $item->include_mapped,
                ]);
            }

            $copy->loadCount('items');
            $copy->load('author:id,name,email');

            return response()->json([
                'data' => $copy,
                'message' => 'Concept set copied.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to copy concept set', $e);
        }
    }

    /**
     * POST /v1/concept-sets/from-bundle
     *
     * Create concept sets from a Care Bundle (one per domain group).
     */
    public function createFromBundle(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bundle_id' => 'required|integer|exists:condition_bundles,id',
            'name' => 'nullable|string|max:255',
        ]);

        try {
            $bundle = ConditionBundle::with('measures')->findOrFail($validated['bundle_id']);
            $baseName = $validated['name'] ?? $bundle->condition_name;
            $userId = $request->user()->id;
            $bundleCode = strtolower($bundle->bundle_code);
            $created = [];

            // Condition concept set (always)
            $conditionSet = ConceptSet::create([
                'name' => "{$baseName} - Conditions",
                'description' => "Condition concepts from {$bundle->condition_name} care bundle.",
                'author_id' => $userId,
                'is_public' => true,
                'tags' => [$bundleCode, 'care-bundle', 'conditions'],
            ]);
            foreach ($bundle->omop_concept_ids as $conceptId) {
                $conditionSet->items()->create([
                    'concept_id' => $conceptId,
                    'is_excluded' => false,
                    'include_descendants' => true,
                    'include_mapped' => false,
                ]);
            }
            $conditionSet->loadCount('items');
            $created[] = $conditionSet;

            // Group measure concept IDs by domain
            $domainGroups = [];
            foreach ($bundle->measures as $measure) {
                $ids = $measure->numerator_criteria['concept_ids'] ?? [];
                $domain = $measure->domain ?? 'other';
                foreach ($ids as $id) {
                    $domainGroups[$domain][$id] = true;
                }
            }

            foreach ($domainGroups as $domain => $ids) {
                $domainLabel = ucfirst($domain) . 's';
                $set = ConceptSet::create([
                    'name' => "{$baseName} - {$domainLabel}",
                    'description' => "{$domainLabel} from {$bundle->condition_name} care bundle.",
                    'author_id' => $userId,
                    'is_public' => true,
                    'tags' => [$bundleCode, 'care-bundle', strtolower($domain)],
                ]);
                foreach (array_keys($ids) as $conceptId) {
                    $set->items()->create([
                        'concept_id' => $conceptId,
                        'is_excluded' => false,
                        'include_descendants' => true,
                        'include_mapped' => false,
                    ]);
                }
                $set->loadCount('items');
                $created[] = $set;
            }

            return response()->json([
                'data' => $created,
                'message' => count($created) . ' concept sets created from bundle.',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to create concept sets from bundle', $e);
        }
    }

    /**
     * PUT /v1/concept-sets/{conceptSet}/items/bulk
     *
     * Bulk update flags on multiple items.
     */
    public function bulkUpdateItems(Request $request, ConceptSet $conceptSet): JsonResponse
    {
        $validated = $request->validate([
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'integer',
            'is_excluded' => 'sometimes|boolean',
            'include_descendants' => 'sometimes|boolean',
            'include_mapped' => 'sometimes|boolean',
        ]);

        try {
            $itemIds = $validated['item_ids'];
            unset($validated['item_ids']);

            $count = $conceptSet->items()
                ->whereIn('id', $itemIds)
                ->update($validated);

            return response()->json([
                'updated' => $count,
                'message' => "{$count} items updated.",
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to bulk update items', $e);
        }
    }

    /**
     * GET /v1/concept-sets/{conceptSet}/resolve
     *
     * Resolve the concept set into a flat list of concept IDs.
     */
    public function resolve(ConceptSet $conceptSet): JsonResponse
    {
        try {
            $conceptIds = $this->resolver->resolve($conceptSet);

            return response()->json([
                'data' => [
                    'concept_set_id' => $conceptSet->id,
                    'concept_ids' => $conceptIds,
                    'count' => count($conceptIds),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to resolve concept set', $e);
        }
    }

    /**
     * POST /v1/concept-sets/{conceptSet}/items
     *
     * Add an item to a concept set.
     */
    public function addItem(Request $request, ConceptSet $conceptSet): JsonResponse
    {
        $validated = $request->validate([
            'concept_id' => 'required|integer',
            'is_excluded' => 'boolean',
            'include_descendants' => 'boolean',
            'include_mapped' => 'boolean',
        ]);

        try {
            $item = $conceptSet->items()->create([
                'concept_id' => $validated['concept_id'],
                'is_excluded' => $validated['is_excluded'] ?? false,
                'include_descendants' => $validated['include_descendants'] ?? false,
                'include_mapped' => $validated['include_mapped'] ?? false,
            ]);

            return response()->json([
                'data' => $item,
                'message' => 'Item added to concept set',
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to add item to concept set', $e);
        }
    }

    /**
     * PUT /v1/concept-sets/{conceptSet}/items/{item}
     *
     * Update flags on a concept set item.
     */
    public function updateItem(Request $request, ConceptSet $conceptSet, ConceptSetItem $item): JsonResponse
    {
        if ($item->concept_set_id !== $conceptSet->id) {
            return response()->json(['message' => 'Item does not belong to this concept set'], 404);
        }

        $validated = $request->validate([
            'is_excluded' => 'boolean',
            'include_descendants' => 'boolean',
            'include_mapped' => 'boolean',
        ]);

        try {
            $item->update($validated);

            return response()->json([
                'data' => $item->fresh(),
                'message' => 'Item updated',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to update item', $e);
        }
    }

    /**
     * DELETE /v1/concept-sets/{conceptSet}/items/{item}
     *
     * Remove an item from a concept set.
     */
    public function removeItem(ConceptSet $conceptSet, ConceptSetItem $item): JsonResponse
    {
        if ($item->concept_set_id !== $conceptSet->id) {
            return response()->json(['message' => 'Item does not belong to this concept set'], 404);
        }

        try {
            $item->delete();

            return response()->json([
                'message' => 'Item removed from concept set',
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to remove item', $e);
        }
    }

    /**
     * POST /v1/concept-sets/import
     *
     * Import one or more concept sets from Atlas format.
     */
    public function import(Request $request): JsonResponse
    {
        $payload = $request->json()->all();
        $items = isset($payload['name']) ? [$payload] : array_values($payload);

        if (empty($items)) {
            return response()->json(['error' => 'No concept sets provided'], 422);
        }

        $imported = 0;
        $skipped = 0;
        $failed = 0;
        $results = [];

        foreach ($items as $item) {
            $name = trim($item['name'] ?? '');
            $expression = $item['expression'] ?? null;
            $atlasItems = $expression['items'] ?? [];

            if (! $name) {
                $failed++;
                $results[] = ['name' => '(unknown)', 'status' => 'failed', 'reason' => 'Missing name'];

                continue;
            }

            $exists = ConceptSet::whereRaw('lower(name) = ?', [strtolower($name)])->exists();
            if ($exists) {
                $skipped++;
                $results[] = ['name' => $name, 'status' => 'skipped', 'reason' => 'Duplicate name'];

                continue;
            }

            try {
                $conceptSet = ConceptSet::create([
                    'name' => $name,
                    'description' => $item['description'] ?? null,
                    'author_id' => $request->user()->id,
                ]);

                foreach ($atlasItems as $atlasItem) {
                    $conceptId = $atlasItem['concept']['CONCEPT_ID'] ?? null;
                    if (! $conceptId) {
                        continue;
                    }

                    $conceptSet->items()->create([
                        'concept_id' => $conceptId,
                        'is_excluded' => (bool) ($atlasItem['isExcluded'] ?? false),
                        'include_descendants' => (bool) ($atlasItem['includeDescendants'] ?? false),
                        'include_mapped' => (bool) ($atlasItem['includeMapped'] ?? false),
                    ]);
                }

                $imported++;
                $results[] = ['name' => $name, 'status' => 'imported', 'id' => $conceptSet->id];
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
     * GET /v1/concept-sets/{conceptSet}/export
     *
     * Export a concept set in Atlas format with full concept objects.
     */
    public function export(ConceptSet $conceptSet): JsonResponse
    {
        $conceptSet->load('items');

        $conceptIds = $conceptSet->items->pluck('concept_id')->unique()->all();
        $concepts = [];
        if (! empty($conceptIds)) {
            $concepts = Concept::whereIn('concept_id', $conceptIds)
                ->get([
                    'concept_id',
                    'concept_name',
                    'domain_id',
                    'vocabulary_id',
                    'concept_class_id',
                    'standard_concept',
                    'concept_code',
                ])
                ->keyBy('concept_id');
        }

        $atlasItems = $conceptSet->items->map(function (ConceptSetItem $item) use ($concepts) {
            $concept = $concepts[$item->concept_id] ?? null;

            return [
                'concept' => [
                    'CONCEPT_ID' => $item->concept_id,
                    'CONCEPT_NAME' => $concept?->concept_name ?? '',
                    'DOMAIN_ID' => $concept?->domain_id ?? '',
                    'VOCABULARY_ID' => $concept?->vocabulary_id ?? '',
                    'CONCEPT_CLASS_ID' => $concept?->concept_class_id ?? '',
                    'STANDARD_CONCEPT' => $concept?->standard_concept ?? '',
                    'CONCEPT_CODE' => $concept?->concept_code ?? '',
                ],
                'isExcluded' => (bool) $item->is_excluded,
                'includeDescendants' => (bool) $item->include_descendants,
                'includeMapped' => (bool) $item->include_mapped,
            ];
        })->values();

        return response()->json([
            'name' => $conceptSet->name,
            'description' => $conceptSet->description,
            'expression' => [
                'items' => $atlasItems,
            ],
        ]);
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
