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
use App\Services\Solr\VocabularySearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * @group Vocabulary
 */
class VocabularyController extends Controller
{
    public function __construct(
        private readonly VocabularySearchService $solrSearch,
    ) {}

    /**
     * Search concepts by name. Uses Solr when available, falls back to PostgreSQL ILIKE.
     */
    public function search(VocabularySearchRequest $request): JsonResponse
    {
        $limit = (int) $request->input('limit', 25);
        $offset = (int) $request->input('offset', 0);

        // Try Solr first
        if ($this->solrSearch->isAvailable()) {
            $filters = array_filter([
                'domain' => $request->input('domain'),
                'vocabulary' => $request->input('vocabulary'),
                'standard' => $request->input('standard'),
            ]);

            $solrResult = $this->solrSearch->search(
                $request->validated('q'),
                $filters,
                $limit,
                $offset,
            );

            if ($solrResult !== null) {
                return response()->json([
                    'data' => $solrResult['items'],
                    'count' => count($solrResult['items']),
                    'total' => $solrResult['total'],
                    'offset' => $offset,
                    'facets' => $solrResult['facets'],
                    'highlights' => $solrResult['highlights'],
                    'engine' => 'solr',
                ]);
            }
        }

        // Fallback to PostgreSQL ILIKE
        $query = Concept::query()
            ->search($request->validated('q'));

        if ($request->filled('domain')) {
            $query->inDomain($request->input('domain'));
        }

        if ($request->filled('vocabulary')) {
            $query->inVocabulary($request->input('vocabulary'));
        }

        if ($request->filled('standard')) {
            $val = $request->input('standard');
            $query->where('standard_concept', in_array($val, ['true', '1', true], true) ? 'S' : $val);
        }

        $total = (clone $query)->count();

        $concepts = $query->offset($offset)->limit($limit)->get([
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
            'total' => $total,
            'offset' => $offset,
            'engine' => 'postgresql',
        ]);
    }

    /**
     * Typeahead concept suggestions (Solr-powered when available).
     */
    public function suggest(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:255',
            'limit' => 'sometimes|integer|min:1|max:20',
        ]);

        $q = $request->input('q');
        $limit = (int) $request->input('limit', 10);

        // Try Solr suggest
        if ($this->solrSearch->isAvailable()) {
            $suggestions = $this->solrSearch->suggest($q, $limit);
            if ($suggestions !== null) {
                return response()->json(['data' => $suggestions, 'engine' => 'solr']);
            }
        }

        // Fallback: simple PG prefix search
        $concepts = Concept::query()
            ->whereRaw('concept_name ILIKE ?', [$q.'%'])
            ->orderByRaw('CASE WHEN standard_concept = ? THEN 0 ELSE 1 END', ['S'])
            ->limit($limit)
            ->get(['concept_id', 'concept_name', 'domain_id', 'vocabulary_id']);

        return response()->json(['data' => $concepts, 'engine' => 'postgresql']);
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

        $total = $concept->relationships()->count();

        $relationships = $concept->relationships()
            ->with(['concept2', 'relationship'])
            ->offset($offset)
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => $relationships,
            'count' => $relationships->count(),
            'total' => $total,
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
     * Return a nested hierarchy tree for a concept:
     * ancestors (with siblings at each level) -> selected concept (is_current) -> children.
     */
    public function hierarchy(int $id): JsonResponse
    {
        // Use explicit vocab.concept to avoid omop.concept shadow table
        $connName = 'vocab';
        $conceptRow = DB::connection($connName)
            ->selectOne('SELECT concept_id, concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept FROM vocab.concept WHERE concept_id = ?', [$id]);

        if (! $conceptRow) {
            abort(404, "Concept {$id} not found");
        }

        $concept = $conceptRow;

        // Get single canonical ancestor path by walking up concept_tree parent chain.
        // This avoids the explosion from concept_ancestor which returns ALL ancestor
        // paths for concepts with multiple parents (e.g., Aspirin maps to 80+ ATC classes).
        // Built iteratively in PHP since recursive CTEs can't use LIMIT per step.
        $ancestors = [];
        $currentId = $id;
        $domain = $concept->domain_id;
        $maxHops = 25;

        for ($hop = 0; $hop < $maxHops; $hop++) {
            $parent = DB::connection($connName)
                ->selectOne('
                    SELECT ct.parent_concept_id,
                           c.concept_id, c.concept_name, c.domain_id,
                           c.vocabulary_id, c.concept_class_id, c.standard_concept
                    FROM vocab.concept_tree ct
                    JOIN vocab.concept c ON c.concept_id = ct.parent_concept_id
                    WHERE ct.child_concept_id = ?
                      AND ct.domain_id = ?
                      AND ct.parent_concept_id > 0
                    ORDER BY ct.parent_concept_id
                    LIMIT 1
                ', [$currentId, $domain]);

            if (! $parent) {
                break;
            }

            $parent->distance = $hop + 1;
            $ancestors[] = $parent;
            $currentId = $parent->concept_id;
        }

        // Reverse so root is first (most distant ancestor first)
        $ancestors = array_reverse($ancestors);

        // Fallback: if concept is not in concept_tree, use concept_ancestor (limited depth)
        if (empty($ancestors)) {
            $ancestors = DB::connection($connName)
                ->select("
                    SELECT
                        ca.ancestor_concept_id AS concept_id,
                        c.concept_name, c.domain_id, c.vocabulary_id,
                        c.concept_class_id, c.standard_concept,
                        ca.min_levels_of_separation AS distance
                    FROM vocab.concept_ancestor ca
                    JOIN vocab.concept c ON c.concept_id = ca.ancestor_concept_id
                    WHERE ca.descendant_concept_id = ?
                      AND ca.min_levels_of_separation BETWEEN 1 AND 10
                      AND c.standard_concept IN ('S', 'C')
                      AND c.domain_id = ?
                    ORDER BY ca.min_levels_of_separation DESC
                    LIMIT 15
                ", [$id, $domain]);
        }

        // Get immediate children of the selected concept
        $children = DB::connection($connName)
            ->select("
                SELECT
                    ca.descendant_concept_id AS concept_id,
                    c.concept_name,
                    c.domain_id,
                    c.vocabulary_id,
                    c.concept_class_id,
                    c.standard_concept
                FROM vocab.concept_ancestor ca
                JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id = ?
                  AND ca.min_levels_of_separation = 1
                  AND c.standard_concept IN ('S', 'C')
                  AND c.domain_id = ?
                ORDER BY c.concept_name
                LIMIT 50
            ", [$id, $domain]);

        // Get siblings at each ancestor level (concepts sharing the same parent)
        $siblingsByParent = [];
        foreach ($ancestors as $i => $ancestor) {
            if ($i === 0) {
                continue; // root has no parent to find siblings under
            }
            $parentId = $ancestors[$i - 1]->concept_id;
            $siblings = DB::connection($connName)
                ->select("
                    SELECT
                        ca.descendant_concept_id AS concept_id,
                        c.concept_name,
                        c.domain_id,
                        c.vocabulary_id,
                        c.concept_class_id,
                        c.standard_concept
                    FROM vocab.concept_ancestor ca
                    JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                    WHERE ca.ancestor_concept_id = ?
                      AND ca.min_levels_of_separation = 1
                      AND ca.descendant_concept_id != ?
                      AND c.standard_concept IN ('S', 'C')
                      AND c.domain_id = ?
                    ORDER BY c.concept_name
                    LIMIT 50
                ", [$parentId, $ancestor->concept_id, $domain]);
            $siblingsByParent[$ancestor->concept_id] = $siblings;
        }

        // Also get siblings of the selected concept itself
        if (! empty($ancestors)) {
            $immediateParentId = $ancestors[count($ancestors) - 1]->concept_id;
            $selfSiblings = DB::connection($connName)
                ->select("
                    SELECT
                        ca.descendant_concept_id AS concept_id,
                        c.concept_name,
                        c.domain_id,
                        c.vocabulary_id,
                        c.concept_class_id,
                        c.standard_concept
                    FROM vocab.concept_ancestor ca
                    JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                    WHERE ca.ancestor_concept_id = ?
                      AND ca.min_levels_of_separation = 1
                      AND ca.descendant_concept_id != ?
                      AND c.standard_concept IN ('S', 'C')
                      AND c.domain_id = ?
                    ORDER BY c.concept_name
                    LIMIT 50
                ", [$immediateParentId, $id, $domain]);
        } else {
            $selfSiblings = [];
        }

        // Build the selected concept node
        $currentNode = [
            'concept_id' => $concept->concept_id,
            'concept_name' => $concept->concept_name,
            'domain_id' => $concept->domain_id,
            'vocabulary_id' => $concept->vocabulary_id,
            'concept_class_id' => $concept->concept_class_id,
            'standard_concept' => $concept->standard_concept,
            'depth' => 0,
            'is_current' => true,
            'children' => array_map(fn ($c) => [
                'concept_id' => $c->concept_id,
                'concept_name' => $c->concept_name,
                'domain_id' => $c->domain_id,
                'vocabulary_id' => $c->vocabulary_id,
                'concept_class_id' => $c->concept_class_id,
                'standard_concept' => $c->standard_concept,
                'depth' => 1,
            ], $children),
        ];

        // Build sibling nodes for the selected concept
        $selfSiblingNodes = array_map(fn ($s) => [
            'concept_id' => $s->concept_id,
            'concept_name' => $s->concept_name,
            'domain_id' => $s->domain_id,
            'vocabulary_id' => $s->vocabulary_id,
            'concept_class_id' => $s->concept_class_id,
            'standard_concept' => $s->standard_concept,
            'depth' => 0,
        ], $selfSiblings);

        // Wrap: immediate parent contains current node + its siblings
        $currentLevel = array_merge([$currentNode], $selfSiblingNodes);

        // Build tree bottom-up: wrap each ancestor level around the current level
        $depth = 0;
        for ($i = count($ancestors) - 1; $i >= 0; $i--) {
            $ancestor = $ancestors[$i];
            $depth++;

            // Sibling nodes at this level
            $levelSiblings = array_map(fn ($s) => [
                'concept_id' => $s->concept_id,
                'concept_name' => $s->concept_name,
                'domain_id' => $s->domain_id,
                'vocabulary_id' => $s->vocabulary_id,
                'concept_class_id' => $s->concept_class_id,
                'standard_concept' => $s->standard_concept,
                'depth' => $depth,
            ], $siblingsByParent[$ancestor->concept_id] ?? []);

            $ancestorNode = [
                'concept_id' => $ancestor->concept_id,
                'concept_name' => $ancestor->concept_name,
                'domain_id' => $ancestor->domain_id,
                'vocabulary_id' => $ancestor->vocabulary_id,
                'concept_class_id' => $ancestor->concept_class_id,
                'standard_concept' => $ancestor->standard_concept,
                'depth' => $depth,
                'children' => $currentLevel,
            ];

            $currentLevel = array_merge([$ancestorNode], $levelSiblings);
        }

        // If there's a single root, return it directly. Otherwise wrap in a virtual root.
        $tree = count($currentLevel) === 1 ? $currentLevel[0] : [
            'concept_id' => 0,
            'concept_name' => $concept->domain_id,
            'domain_id' => $concept->domain_id,
            'vocabulary_id' => '',
            'concept_class_id' => '',
            'standard_concept' => null,
            'depth' => $depth + 1,
            'children' => $currentLevel,
        ];

        return response()->json(['data' => $tree]);
    }

    /**
     * GET /v1/vocabulary/tree
     *
     * Browse the concept_tree. Returns children of a given parent concept.
     * parent_concept_id=0 (default) returns domain roots.
     */
    public function tree(Request $request): JsonResponse
    {
        $parentId = (int) $request->query('parent_concept_id', '0');
        $domainId = $request->query('domain_id');

        $query = DB::connection('vocab')
            ->table('concept_tree AS ct')
            ->select([
                'ct.child_concept_id AS concept_id',
                'ct.child_name AS concept_name',
                'ct.domain_id',
                'ct.vocabulary_id',
                'ct.concept_class_id',
                'ct.child_depth AS depth',
            ])
            ->selectRaw('(SELECT COUNT(*) FROM vocab.concept_tree ct2 WHERE ct2.parent_concept_id = ct.child_concept_id AND ct2.domain_id = ct.domain_id) AS child_count')
            ->where('ct.parent_concept_id', $parentId);

        if ($domainId) {
            $query->where('ct.domain_id', $domainId);
        }

        $results = $query->orderBy('ct.child_name')->limit(500)->get();

        return response()->json([
            'data' => $results,
            'parent_concept_id' => $parentId,
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
