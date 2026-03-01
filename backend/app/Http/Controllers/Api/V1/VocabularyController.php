<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\VocabularySearchRequest;
use App\Models\Vocabulary\Concept;
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
}
