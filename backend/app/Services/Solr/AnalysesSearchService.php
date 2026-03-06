<?php

namespace App\Services\Solr;

class AnalysesSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search Achilles analyses via Solr with faceted filtering.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>, highlights: array<string, array<string, string[]>>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 50, int $offset = 0): ?array
    {
        $core = config('solr.cores.analyses', 'analyses');

        $params = [
            'q' => $query ?: '*:*',
            'defType' => 'edismax',
            'qf' => 'analysis_name^3 category^2 stratum_1_name^1 stratum_2_name^1',
            'pf' => 'analysis_name^5',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'id,analysis_id,analysis_name,category,source_id,source_name,stratum_1_name,stratum_2_name,stratum_3_name,stratum_4_name,stratum_5_name,row_count',
            'hl' => 'true',
            'hl.fl' => 'analysis_name',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['category', 'source_name'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
            'sort' => 'analysis_id asc',
        ];

        $fq = [];

        if (! empty($filters['source_id'])) {
            $fq[] = 'source_id:'.(int) $filters['source_id'];
        }

        if (! empty($filters['category'])) {
            $fq[] = 'category:'.self::escapeValue($filters['category']);
        }

        if (! empty($fq)) {
            $params['fq'] = $fq;
        }

        // If query is wildcard, don't use edismax
        if ($query === '' || $query === '*:*') {
            unset($params['defType'], $params['qf'], $params['pf']);
        }

        $result = $this->solr->select($core, $params);

        if ($result === null) {
            return null;
        }

        $docs = $result['response']['docs'] ?? [];
        $total = $result['response']['numFound'] ?? 0;

        return [
            'items' => $docs,
            'total' => $total,
            'facets' => $this->parseFacets($result['facet_counts']['facet_fields'] ?? []),
            'highlights' => $result['highlighting'] ?? [],
        ];
    }

    /**
     * @param  array<string, array<int, string|int>>  $facetFields
     * @return array<string, array<string, int>>
     */
    private function parseFacets(array $facetFields): array
    {
        $facets = [];

        foreach ($facetFields as $field => $values) {
            $facets[$field] = [];
            for ($i = 0, $len = count($values); $i < $len; $i += 2) {
                $name = (string) $values[$i];
                $count = (int) ($values[$i + 1] ?? 0);
                if ($count > 0) {
                    $facets[$field][$name] = $count;
                }
            }
        }

        return $facets;
    }

    private static function escapeValue(string $value): string
    {
        return '"'.addcslashes($value, '"\\').'"';
    }
}
