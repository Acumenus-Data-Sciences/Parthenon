<?php

namespace App\Services\QueryLibrary;

use App\Models\App\QueryLibraryEntry;
use App\Services\Solr\SolrClientWrapper;

class QueryLibrarySearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function search(string $query, ?string $domain = null, int $limit = 8): array
    {
        $query = trim($query);

        if ($query !== '') {
            $solrResults = $this->searchSolr($query, $domain, $limit);
            if ($solrResults !== null) {
                return $solrResults;
            }
        }

        return $this->searchDatabase($query, $domain, $limit);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function featured(int $limit = 6): array
    {
        $query = QueryLibraryEntry::query();

        return [
            'items' => $query
                ->orderBy('domain')
                ->orderBy('name')
                ->limit($limit)
                ->get()
                ->map(fn (QueryLibraryEntry $entry) => $this->serializeEntry($entry))
                ->all(),
            'total' => (clone $query)->count(),
        ];
    }

    /**
     * @return array<int, array{domain:string, count:int}>
     */
    public function domainCounts(string $query = ''): array
    {
        $query = trim($query);

        if ($query !== '') {
            $solrCounts = $this->domainCountsSolr($query);
            if ($solrCounts !== null) {
                return $solrCounts;
            }
        }

        return QueryLibraryEntry::query()
            ->selectRaw('domain, COUNT(*) as aggregate_count')
            ->groupBy('domain')
            ->orderByDesc('aggregate_count')
            ->orderBy('domain')
            ->get()
            ->map(fn (QueryLibraryEntry $entry) => [
                'domain' => (string) $entry->domain,
                'count' => (int) ($entry->aggregate_count ?? 0),
            ])
            ->all();
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}|null
     */
    private function searchSolr(string $query, ?string $domain, int $limit): ?array
    {
        $core = config('solr.cores.query_library', 'query_library');
        $params = [
            'q' => $query,
            'defType' => 'edismax',
            'qf' => 'name^4 summary^3 description^2 tags^2 example_questions^2 domain^1 category^1',
            'pf' => 'name^8 summary^4',
            'rows' => $limit,
            'fl' => 'id,slug,name,domain,category,summary,tags,source,is_aggregate,safety',
        ];

        if ($domain) {
            $params['fq'] = 'domain:'.'"'.addcslashes($domain, '"\\').'"';
        }

        $result = $this->solr->select($core, $params);
        if ($result === null) {
            return null;
        }

        // Get IDs from Solr, then hydrate full entries from DB (for parameters, etc.)
        $solrIds = collect($result['response']['docs'] ?? [])
            ->pluck('id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($solrIds === []) {
            return ['items' => [], 'total' => (int) ($result['response']['numFound'] ?? 0)];
        }

        $entries = QueryLibraryEntry::query()
            ->whereIn('id', $solrIds)
            ->get()
            ->keyBy('id');

        // Preserve Solr relevance ordering
        $items = collect($solrIds)
            ->map(fn (int $id) => $entries->get($id))
            ->filter()
            ->map(fn (QueryLibraryEntry $entry) => $this->serializeEntry($entry))
            ->values()
            ->all();

        return [
            'items' => $items,
            'total' => (int) ($result['response']['numFound'] ?? 0),
        ];
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    private function searchDatabase(string $query, ?string $domain, int $limit): array
    {
        $entries = QueryLibraryEntry::query()
            ->when($domain, fn ($builder) => $builder->where('domain', $domain))
            ->get();

        $scored = $entries
            ->map(function (QueryLibraryEntry $entry) use ($query) {
                $haystack = collect([
                    $entry->name,
                    $entry->summary,
                    $entry->description,
                    implode(' ', $entry->tags_json ?? []),
                    implode(' ', $entry->example_questions_json ?? []),
                ])->filter()->implode(' ');

                $score = $query === '' ? 1 : $this->scoreMatch($query, $haystack, $entry);

                return [
                    'score' => $score,
                    'entry' => $entry,
                ];
            })
            ->filter(fn (array $item) => $item['score'] > 0)
            ->sortByDesc('score')
            ->take($limit)
            ->map(fn (array $item) => $this->serializeEntry($item['entry']))
            ->values();

        return [
            'items' => $scored->all(),
            'total' => $scored->count(),
        ];
    }

    /**
     * @return array<int, array{domain:string, count:int}>|null
     */
    private function domainCountsSolr(string $query): ?array
    {
        $core = config('solr.cores.query_library', 'query_library');
        $params = [
            'q' => $query,
            'defType' => 'edismax',
            'qf' => 'name^4 summary^3 description^2 tags^2 example_questions^2 domain^1 category^1',
            'rows' => 0,
            'facet' => 'true',
            'facet.field' => 'domain',
            'facet.limit' => 50,
            'facet.mincount' => 1,
        ];

        $result = $this->solr->select($core, $params);
        if ($result === null) {
            return null;
        }

        $facets = $result['facet_counts']['facet_fields']['domain'] ?? null;
        if (! is_array($facets)) {
            return null;
        }

        $counts = [];
        for ($i = 0; $i < count($facets); $i += 2) {
            $domain = $facets[$i] ?? null;
            $count = $facets[$i + 1] ?? null;
            if (! is_string($domain) || ! is_numeric($count)) {
                continue;
            }

            $counts[] = [
                'domain' => $domain,
                'count' => (int) $count,
            ];
        }

        return $counts;
    }

    private function scoreMatch(string $query, string $haystack, QueryLibraryEntry $entry): int
    {
        $q = mb_strtolower($query);
        $score = 0;

        if (str_contains(mb_strtolower($entry->name), $q)) {
            $score += 10;
        }
        if (str_contains(mb_strtolower($entry->summary), $q)) {
            $score += 6;
        }
        if (str_contains(mb_strtolower($haystack), $q)) {
            $score += 3;
        }

        foreach (preg_split('/\s+/', $q) ?: [] as $token) {
            if ($token !== '' && str_contains(mb_strtolower($haystack), $token)) {
                $score += 1;
            }
        }

        return $score;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeEntry(QueryLibraryEntry $entry): array
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
}
