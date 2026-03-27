<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\QueryLibraryEntry;
use App\Services\QueryLibrary\QueryLibrarySearchService;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Query Library
 */
class QueryLibraryController extends Controller
{
    public function __construct(
        private readonly QueryLibrarySearchService $search,
        private readonly SqlRendererService $renderer,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'sometimes|string|max:255',
            'domain' => 'sometimes|string|max:100',
            'limit' => 'sometimes|integer|min:1|max:20',
        ]);

        $limit = (int) ($validated['limit'] ?? 8);
        $query = trim((string) ($validated['q'] ?? ''));
        $domain = $validated['domain'] ?? null;

        $result = $query === ''
            ? $this->search->featured($limit)
            : $this->search->search($query, $domain, $limit);

        return response()->json([
            'data' => $result['items'],
            'meta' => [
                'query' => $query,
                'domain' => $domain,
                'count' => count($result['items']),
                'total' => $result['total'],
                'indexed_total' => QueryLibraryEntry::query()->count(),
                'domain_counts' => $this->search->domainCounts($query),
            ],
        ]);
    }

    public function show(QueryLibraryEntry $queryLibrary): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeDetail($queryLibrary),
        ]);
    }

    public function render(Request $request, QueryLibraryEntry $queryLibrary): JsonResponse
    {
        $validated = $request->validate([
            'dialect' => 'sometimes|string|max:50',
            'params' => 'sometimes|array',
        ]);

        $dialect = (string) ($validated['dialect'] ?? 'postgresql');
        $providedParams = $validated['params'] ?? [];

        $defaults = collect($queryLibrary->parameters_json ?? [])
            ->mapWithKeys(fn (array $parameter) => [
                $parameter['key'] => (string) ($parameter['default'] ?? ''),
            ])
            ->all();

        $params = array_merge($defaults, array_map(
            fn ($value) => is_scalar($value) ? (string) $value : '',
            $providedParams
        ));

        $sql = $this->renderer->render($queryLibrary->sql_template, $params, $dialect);

        return response()->json([
            'data' => [
                'sql' => $sql,
                'explanation' => $queryLibrary->description ?: $queryLibrary->summary,
                'tables_referenced' => $this->extractTables($sql),
                'is_aggregate' => (bool) $queryLibrary->is_aggregate,
                'safety' => $queryLibrary->safety,
                'source_type' => 'library',
                'template_name' => $queryLibrary->name,
                'query' => $this->serializeDetail($queryLibrary),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDetail(QueryLibraryEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'slug' => $entry->slug,
            'name' => $entry->name,
            'domain' => $entry->domain,
            'category' => $entry->category,
            'summary' => $entry->summary,
            'description' => $entry->description,
            'parameters' => $entry->parameters_json ?? [],
            'tags' => $entry->tags_json ?? [],
            'example_questions' => $entry->example_questions_json ?? [],
            'source' => $entry->source,
            'is_aggregate' => $entry->is_aggregate,
            'safety' => $entry->safety,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function extractTables(string $sql): array
    {
        preg_match_all('/(?:FROM|JOIN)\s+(?:\w+\.)?(\w+)/i', $sql, $matches);

        return array_values(array_unique(array_map('strtolower', $matches[1] ?? [])));
    }
}
