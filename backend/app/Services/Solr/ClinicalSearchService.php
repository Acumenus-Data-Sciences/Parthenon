<?php

namespace App\Services\Solr;

use Illuminate\Support\Facades\Http;

class ClinicalSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search clinical events across patients/sources via Solr.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 50, int $offset = 0): ?array
    {
        $core = config('solr.cores.clinical', 'clinical');

        $params = [
            'q' => $query ?: '*:*',
            'defType' => 'edismax',
            'qf' => 'concept_name^3 value_as_string^1 note_text^2 note_title^2',
            'pf' => 'concept_name^3 note_title^2',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'event_id,event_type,person_id,concept_id,concept_name,domain_id,vocabulary_id,event_date,event_end_date,source_id,source_name,value_as_number,value_as_string,unit,type_concept_name,note_title,note_text,note_class,provider_id',
            'hl' => 'true',
            'hl.fl' => 'concept_name,value_as_string,note_text,note_title',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['event_type', 'domain_id', 'source_name', 'vocabulary_id'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
            'sort' => 'event_date desc',
        ];

        $fq = [];

        if (! empty($filters['source_id'])) {
            $fq[] = 'source_id:'.(int) $filters['source_id'];
        }

        if (! empty($filters['person_id'])) {
            $fq[] = 'person_id:'.(int) $filters['person_id'];
        }

        if (! empty($filters['event_type'])) {
            $fq[] = 'event_type:'.self::escapeValue($filters['event_type']);
        }

        if (! empty($filters['domain_id'])) {
            $fq[] = 'domain_id:'.self::escapeValue($filters['domain_id']);
        }

        if (! empty($filters['concept_id'])) {
            $fq[] = 'concept_id:'.(int) $filters['concept_id'];
        }

        if (! empty($filters['date_from'])) {
            $fq[] = 'event_date:['.$filters['date_from'].'T00:00:00Z TO *]';
        }

        if (! empty($filters['date_to'])) {
            $fq[] = 'event_date:[* TO '.$filters['date_to'].'T23:59:59Z]';
        }

        if (! empty($filters['value_min'])) {
            $fq[] = 'value_as_number:['.((float) $filters['value_min']).' TO *]';
        }

        if (! empty($filters['value_max'])) {
            $fq[] = 'value_as_number:[* TO '.((float) $filters['value_max']).']';
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
     * Delete all clinical events for a specific source.
     */
    public function deleteBySource(int $sourceId): bool
    {
        if (! $this->solr->isEnabled()) {
            return false;
        }

        $core = config('solr.cores.clinical', 'clinical');
        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("http://{$host}:{$port}/solr/{$core}/update?commit=true", [
                    'delete' => ['query' => "source_id:{$sourceId}"],
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
        return '"'.addcslashes($value, '"\\\/').'\"';
    }
}
