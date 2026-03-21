<?php

namespace App\Services\Solr;

use Illuminate\Support\Facades\Http;

class MappingSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search concept mappings via Solr with faceted filtering.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 50, int $offset = 0): ?array
    {
        $core = config('solr.cores.mappings', 'mappings');

        $params = [
            'q' => $query ?: '*:*',
            'defType' => 'edismax',
            'qf' => 'source_code_text^3 source_description^2 target_concept_name^2 source_code^1',
            'pf' => 'source_description^3 target_concept_name^3',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'id,ingestion_job_id,source_code,source_description,source_vocabulary_id,target_concept_id,target_concept_name,target_domain_id,confidence,strategy,review_tier,is_reviewed,source_table,source_column,source_frequency,job_file_name,created_at',
            'hl' => 'true',
            'hl.fl' => 'source_description,target_concept_name',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['review_tier', 'source_vocabulary_id', 'target_domain_id', 'strategy', 'is_reviewed', 'source_table'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
            'sort' => 'confidence desc',
        ];

        $fq = [];

        if (! empty($filters['ingestion_job_id'])) {
            $fq[] = 'ingestion_job_id:'.(int) $filters['ingestion_job_id'];
        }

        if (! empty($filters['review_tier'])) {
            $fq[] = 'review_tier:'.self::escapeValue($filters['review_tier']);
        }

        if (isset($filters['is_reviewed'])) {
            $fq[] = 'is_reviewed:'.($filters['is_reviewed'] ? 'true' : 'false');
        }

        if (! empty($filters['source_vocabulary_id'])) {
            $fq[] = 'source_vocabulary_id:'.self::escapeValue($filters['source_vocabulary_id']);
        }

        if (! empty($filters['target_domain_id'])) {
            $fq[] = 'target_domain_id:'.self::escapeValue($filters['target_domain_id']);
        }

        if (isset($filters['confidence_min'])) {
            $fq[] = 'confidence:['.((float) $filters['confidence_min']).' TO *]';
        }

        if (isset($filters['confidence_max'])) {
            $fq[] = 'confidence:[* TO '.((float) $filters['confidence_max']).']';
        }

        if (! empty($fq)) {
            $params['fq'] = $fq;
        }

        if ($query === '' || $query === '*:*') {
            unset($params['defType'], $params['qf'], $params['pf']);
        }

        $result = $this->solr->select($core, $params);

        if ($result === null) {
            return null;
        }

        return [
            'items' => $result['response']['docs'] ?? [],
            'total' => $result['response']['numFound'] ?? 0,
            'facets' => $this->parseFacets($result['facet_counts']['facet_fields'] ?? []),
        ];
    }

    /**
     * Index a single mapping document.
     *
     * @param  array<string, mixed>  $doc
     */
    public function indexMapping(array $doc): bool
    {
        $core = config('solr.cores.mappings', 'mappings');

        return $this->solr->addDocuments($core, [$doc], true);
    }

    /**
     * Delete all mappings for a specific ingestion job.
     */
    public function deleteByJob(int $jobId): bool
    {
        if (! $this->solr->isEnabled()) {
            return false;
        }

        $core = config('solr.cores.mappings', 'mappings');
        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);

        try {
            $response = Http::timeout(5)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("http://{$host}:{$port}/solr/{$core}/update?commit=true", [
                    'delete' => ['query' => "ingestion_job_id:{$jobId}"],
                ]);

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
