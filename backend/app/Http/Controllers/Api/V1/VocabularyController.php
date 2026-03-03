<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\VocabularySearchRequest;
use App\Models\Vocabulary\Concept;
use App\Models\Vocabulary\ConceptAncestor;
use App\Models\Vocabulary\ConceptRelationship;
use App\Models\Vocabulary\Domain;
use App\Models\Vocabulary\Vocabulary;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VocabularyController extends Controller
{
    /**
     * Search concepts by name using trigram similarity.
     */
    public function search(VocabularySearchRequest $request): JsonResponse
    {
        $query = Concept::query()
            ->search($request->validated('q'));

        if ($request->filled('domain')) {
            $query->inDomain($request->input('domain'));
        }

        if ($request->filled('vocabulary')) {
            $query->inVocabulary($request->input('vocabulary'));
        }

        if ($request->filled('standard')) {
            $query->where('standard_concept', $request->input('standard'));
        }

        $limit = (int) $request->input('limit', 25);

        $concepts = $query->limit($limit)->get([
            'concept_id',
            'concept_name',
            'domain_id',
            'vocabulary_id',
            'concept_class_id',
            'standard_concept',
            'concept_code',
        ]);

        return response()->json([
            'data' => $concepts,
            'count' => $concepts->count(),
        ]);
    }

    /**
     * Get a single concept with relationships and synonyms.
     */
    public function show(int $id): JsonResponse
    {
        $concept = Concept::with(['vocabulary', 'domain', 'conceptClass', 'synonyms'])
            ->findOrFail($id);

        return response()->json(['data' => $concept]);
    }

    /**
     * Get concept relationships (paginated).
     */
    public function relationships(Request $request, int $id): JsonResponse
    {
        $concept = Concept::findOrFail($id);

        $limit = (int) $request->input('limit', 25);
        $offset = (int) $request->input('offset', 0);

        $relationships = $concept->relationships()
            ->with(['concept2', 'relationship'])
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $relationships,
            'count' => $relationships->count(),
            'concept_id' => $id,
        ]);
    }

    /**
     * Get concept ancestors.
     */
    public function ancestors(int $id): JsonResponse
    {
        $concept = Concept::findOrFail($id);

        $ancestors = $concept->ancestors()
            ->with('ancestor')
            ->orderBy('min_levels_of_separation')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $ancestors,
            'count' => $ancestors->count(),
            'concept_id' => $id,
        ]);
    }

    /**
     * Semantic search using SapBERT embeddings via AI service.
     */
    public function semanticSearch(Request $request, AiService $aiService): JsonResponse
    {
        $request->validate([
            'query' => 'required|string|min:2|max:255',
            'top_k' => 'sometimes|integer|min:1|max:100',
        ]);

        $query = $request->input('query');
        $topK = (int) $request->input('top_k', 10);

        $results = $aiService->searchConcepts($query, $topK);

        return response()->json($results);
    }

    /**
     * GET /v1/vocabulary/concepts/{id}/descendants
     *
     * Get all descendant concepts of a given concept (paginated).
     */
    public function descendants(Request $request, int $id): JsonResponse
    {
        $concept = Concept::findOrFail($id);

        $limit = (int) $request->input('limit', 25);
        $offset = (int) $request->input('offset', 0);

        $descendants = $concept->descendants()
            ->with('descendant')
            ->orderBy('min_levels_of_separation')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map(fn (ConceptAncestor $ca) => [
                'concept_id' => $ca->descendant_concept_id,
                'concept_name' => $ca->descendant?->concept_name,
                'domain_id' => $ca->descendant?->domain_id,
                'vocabulary_id' => $ca->descendant?->vocabulary_id,
                'concept_class_id' => $ca->descendant?->concept_class_id,
                'standard_concept' => $ca->descendant?->standard_concept,
                'min_levels_of_separation' => $ca->min_levels_of_separation,
                'max_levels_of_separation' => $ca->max_levels_of_separation,
            ]);

        return response()->json([
            'data' => $descendants,
            'count' => $descendants->count(),
            'concept_id' => $id,
        ]);
    }

    /**
     * GET /v1/vocabulary/concepts/{id}/hierarchy
     *
     * Get the ancestor hierarchy of a concept (root first).
     */
    public function hierarchy(int $id): JsonResponse
    {
        $concept = Concept::findOrFail($id);

        $ancestors = $concept->ancestors()
            ->with('ancestor')
            ->orderByDesc('min_levels_of_separation')
            ->limit(100)
            ->get()
            ->map(fn (ConceptAncestor $ca) => [
                'concept_id' => $ca->ancestor_concept_id,
                'concept_name' => $ca->ancestor?->concept_name,
                'domain_id' => $ca->ancestor?->domain_id,
                'vocabulary_id' => $ca->ancestor?->vocabulary_id,
                'concept_class_id' => $ca->ancestor?->concept_class_id,
                'standard_concept' => $ca->ancestor?->standard_concept,
                'min_levels_of_separation' => $ca->min_levels_of_separation,
                'max_levels_of_separation' => $ca->max_levels_of_separation,
            ]);

        return response()->json([
            'data' => $ancestors,
            'count' => $ancestors->count(),
            'concept_id' => $id,
        ]);
    }

    /**
     * GET /v1/vocabulary/domains
     *
     * List all domains with concept counts.
     */
    public function domains(): JsonResponse
    {
        $domains = Domain::withCount('concepts')
            ->orderBy('domain_id')
            ->get();

        return response()->json([
            'data' => $domains,
            'count' => $domains->count(),
        ]);
    }

    /**
     * GET /v1/vocabulary/vocabularies-list
     *
     * List all vocabularies with concept counts.
     */
    public function vocabularies(): JsonResponse
    {
        $vocabularies = Vocabulary::withCount('concepts')
            ->orderBy('vocabulary_id')
            ->get();

        return response()->json([
            'data' => $vocabularies,
            'count' => $vocabularies->count(),
        ]);
    }

    /**
     * GET /v1/vocabulary/compare?ids[]=X&ids[]=Y
     *
     * Compare 2–4 concepts side-by-side with attributes, relationships,
     * and first 2 levels of ancestors.
     */
    public function compare(Request $request): JsonResponse
    {
        $request->validate([
            'ids' => 'required|array|min:2|max:4',
            'ids.*' => 'integer',
        ]);

        $ids = $request->input('ids');

        $concepts = Concept::with(['vocabulary', 'domain', 'conceptClass', 'synonyms'])
            ->whereIn('concept_id', $ids)
            ->get()
            ->keyBy('concept_id');

        $results = [];

        foreach ($ids as $id) {
            $concept = $concepts->get((int) $id);
            if (! $concept) {
                continue;
            }

            // First 2 levels of ancestors
            $ancestors = $concept->ancestors()
                ->with('ancestor')
                ->where('min_levels_of_separation', '<=', 2)
                ->where('min_levels_of_separation', '>', 0)
                ->orderBy('min_levels_of_separation')
                ->limit(20)
                ->get()
                ->map(fn (ConceptAncestor $ca) => [
                    'concept_id' => $ca->ancestor_concept_id,
                    'concept_name' => $ca->ancestor?->concept_name,
                    'domain_id' => $ca->ancestor?->domain_id,
                    'vocabulary_id' => $ca->ancestor?->vocabulary_id,
                    'min_levels_of_separation' => $ca->min_levels_of_separation,
                ]);

            // Key relationships (up to 20)
            $relationships = $concept->relationships()
                ->with(['concept2', 'relationship'])
                ->limit(20)
                ->get()
                ->map(fn ($rel) => [
                    'relationship_id' => $rel->relationship_id,
                    'concept_id_2' => $rel->concept_id_2,
                    'concept_name' => $rel->concept2?->concept_name,
                    'domain_id' => $rel->concept2?->domain_id,
                    'vocabulary_id' => $rel->concept2?->vocabulary_id,
                ]);

            $results[] = [
                'concept' => $concept,
                'ancestors' => $ancestors,
                'relationships' => $relationships,
            ];
        }

        return response()->json(['data' => $results]);
    }

    /**
     * GET /v1/vocabulary/concepts/{id}/maps-from
     *
     * Get source codes that map to this standard concept
     * (reverse of "Maps to").
     */
    public function mapsFrom(Request $request, int $id): JsonResponse
    {
        Concept::findOrFail($id);

        $limit = (int) $request->input('limit', 50);
        $offset = (int) $request->input('offset', 0);

        $mappings = ConceptRelationship::with('concept1')
            ->where('concept_id_2', $id)
            ->where('relationship_id', 'Mapped from')
            ->offset($offset)
            ->limit($limit)
            ->get()
            ->map(fn ($rel) => [
                'concept_id' => $rel->concept_id_1,
                'concept_name' => $rel->concept1?->concept_name,
                'domain_id' => $rel->concept1?->domain_id,
                'vocabulary_id' => $rel->concept1?->vocabulary_id,
                'concept_class_id' => $rel->concept1?->concept_class_id,
                'concept_code' => $rel->concept1?->concept_code,
                'standard_concept' => $rel->concept1?->standard_concept,
            ]);

        $total = ConceptRelationship::where('concept_id_2', $id)
            ->where('relationship_id', 'Mapped from')
            ->count();

        return response()->json([
            'data' => $mappings,
            'total' => $total,
            'concept_id' => $id,
        ]);
    }
}
