<?php

namespace App\Services\Solr;

class CohortSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search cohorts and studies via Solr with faceted filtering.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>, highlights: array<string, array<string, string[]>>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 25, int $offset = 0): ?array
    {
        $core = config('solr.cores.cohorts', 'cohorts');

        $params = [
            'q' => $query ?: '*:*',
            'defType' => 'edismax',
            'qf' => 'name^3 description^1 tags^2 author_name^1 scientific_rationale^0.5 hypothesis^0.5',
            'pf' => 'name^5',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'id,type,name,description,tags,author_name,author_id,status,is_public,created_at,updated_at,person_count,generation_count,version,study_type,study_design,phase,priority,pi_name',
            'hl' => 'true',
            'hl.fl' => 'name,description',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['type', 'status', 'tags', 'author_name', 'study_type', 'phase', 'priority'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
            'sort' => 'updated_at desc',
        ];

        $fq = [];

        if (! empty($filters['type'])) {
            $fq[] = 'type:'.self::escapeValue($filters['type']);
        }

        if (! empty($filters['status'])) {
            $fq[] = 'status:'.self::escapeValue($filters['status']);
        }

        if (! empty($filters['tags'])) {
            $tags = (array) $filters['tags'];
            foreach ($tags as $tag) {
                $fq[] = 'tags:'.self::escapeValue($tag);
            }
        }

        if (! empty($filters['author_id'])) {
            $fq[] = 'author_id:'.(int) $filters['author_id'];
        }

        if (! empty($filters['study_type'])) {
            $fq[] = 'study_type:'.self::escapeValue($filters['study_type']);
        }

        if (! empty($filters['study_design'])) {
            $fq[] = 'study_design:'.self::escapeValue($filters['study_design']);
        }

        if (! empty($filters['phase'])) {
            $fq[] = 'phase:'.self::escapeValue($filters['phase']);
        }

        if (! empty($filters['priority'])) {
            $fq[] = 'priority:'.self::escapeValue($filters['priority']);
        }

        if (isset($filters['is_public'])) {
            $fq[] = 'is_public:'.($filters['is_public'] ? 'true' : 'false');
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
     * Index a single cohort definition into Solr.
     *
     * @param  array<string, mixed>  $doc
     */
    public function indexCohort(array $doc): bool
    {
        $core = config('solr.cores.cohorts', 'cohorts');

        return $this->solr->addDocuments($core, [$doc], true);
    }

    /**
     * Index a single study into Solr.
     *
     * @param  array<string, mixed>  $doc
     */
    public function indexStudy(array $doc): bool
    {
        $core = config('solr.cores.cohorts', 'cohorts');

        return $this->solr->addDocuments($core, [$doc], true);
    }

    /**
     * Delete a document from the cohorts core.
     */
    public function delete(string $id): bool
    {
        if (! $this->solr->isEnabled()) {
            return false;
        }

        $core = config('solr.cores.cohorts', 'cohorts');
        $url = "http://".config('solr.endpoint.default.host', 'solr').":".config('solr.endpoint.default.port', 8983)."/solr/{$core}/update?commit=true";

        try {
            $response = \Illuminate\Support\Facades\Http::timeout(5)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, ['delete' => ['id' => $id]]);

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
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
