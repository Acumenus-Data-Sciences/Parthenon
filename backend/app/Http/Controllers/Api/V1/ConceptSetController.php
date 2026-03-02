<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\Vocabulary\Concept;
use App\Services\ConceptSet\ConceptSetResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConceptSetController extends Controller
{
    public function __construct(
        private readonly ConceptSetResolverService $resolver,
    ) {}

    /**
     * GET /v1/concept-sets
     *
     * List all concept sets (paginated), with items count.
     */
    public function index(): JsonResponse
    {
        try {
            $conceptSets = ConceptSet::withCount('items')
                ->orderByDesc('updated_at')
                ->paginate(20);

            return response()->json($conceptSets);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve concept sets', $e);
        }
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
                    'concept_name' => $concept?->concept_name,
                    'domain_id' => $concept?->domain_id,
                    'vocabulary_id' => $concept?->vocabulary_id,
                    'concept_class_id' => $concept?->concept_class_id,
                    'standard_concept' => $concept?->standard_concept,
                    'concept_code' => $concept?->concept_code,
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
