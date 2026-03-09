<?php

namespace App\Services\Solr;

class ClaimsSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    public function isAvailable(): bool
    {
        return $this->solr->isAvailable();
    }

    /**
     * Search claims via Solr with full-text query and financial/date filters.
     *
     * @param  array<string, mixed>  $filters
     * @return array{items: list<array<string, mixed>>, total: int, facets: array<string, array<string, int>>, stats: array<string, mixed>}|null
     */
    public function search(string $query, array $filters = [], int $limit = 50, int $offset = 0): ?array
    {
        $core = config('solr.cores.claims', 'claims');

        $params = [
            'q' => $query ?: '*:*',
            'defType' => 'edismax',
            'qf' => 'patient_name^3 diagnosis_names^2 line_notes^1 procedure_codes^1',
            'pf' => 'patient_name^3 diagnosis_names^2',
            'start' => $offset,
            'rows' => $limit,
            'fl' => 'claim_id,patient_id,patient_name,provider_id,service_date,last_billed_date,diagnosis_codes,diagnosis_names,claim_status,claim_type,total_charge,total_payment,total_adjustment,outstanding,transaction_count,procedure_codes,place_of_service,department_id,appointment_id',
            'hl' => 'true',
            'hl.fl' => 'patient_name,diagnosis_names,line_notes',
            'hl.simple.pre' => '<mark>',
            'hl.simple.post' => '</mark>',
            'facet' => 'true',
            'facet.field' => ['claim_status', 'claim_type', 'place_of_service', 'diagnosis_codes'],
            'facet.mincount' => 1,
            'facet.limit' => 50,
            'sort' => 'service_date desc',
            'stats' => 'true',
            'stats.field' => ['total_charge', 'total_payment', 'outstanding'],
        ];

        $fq = [];

        if (! empty($filters['patient_id'])) {
            $fq[] = 'patient_id:'.(int) $filters['patient_id'];
        }

        if (! empty($filters['claim_status'])) {
            $fq[] = 'claim_status:'.self::escapeValue($filters['claim_status']);
        }

        if (! empty($filters['claim_type'])) {
            $fq[] = 'claim_type:'.self::escapeValue($filters['claim_type']);
        }

        if (! empty($filters['place_of_service'])) {
            $fq[] = 'place_of_service:'.self::escapeValue($filters['place_of_service']);
        }

        if (! empty($filters['diagnosis_code'])) {
            $fq[] = 'diagnosis_codes:'.self::escapeValue($filters['diagnosis_code']);
        }

        if (! empty($filters['date_from'])) {
            $fq[] = 'service_date:['.$filters['date_from'].'T00:00:00Z TO *]';
        }

        if (! empty($filters['date_to'])) {
            $fq[] = 'service_date:[* TO '.$filters['date_to'].'T23:59:59Z]';
        }

        if (! empty($filters['min_charge'])) {
            $fq[] = 'total_charge:['.((float) $filters['min_charge']).' TO *]';
        }

        if (! empty($filters['max_charge'])) {
            $fq[] = 'total_charge:[* TO '.((float) $filters['max_charge']).']';
        }

        if (! empty($filters['has_outstanding'])) {
            $fq[] = 'outstanding:[0.01 TO *]';
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
            'stats' => $this->parseStats($result['stats']['stats_fields'] ?? []),
        ];
    }

    /**
     * Delete all claims from the index.
     */
    public function deleteAll(): bool
    {
        if (! $this->solr->isEnabled()) {
            return false;
        }

        $core = config('solr.cores.claims', 'claims');

        return $this->solr->deleteAll($core);
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

    /**
     * @param  array<string, array<string, mixed>>  $statsFields
     * @return array<string, array<string, mixed>>
     */
    private function parseStats(array $statsFields): array
    {
        $stats = [];

        foreach ($statsFields as $field => $fieldStats) {
            $stats[$field] = [
                'min' => $fieldStats['min'] ?? 0,
                'max' => $fieldStats['max'] ?? 0,
                'sum' => $fieldStats['sum'] ?? 0,
                'mean' => $fieldStats['mean'] ?? 0,
                'count' => $fieldStats['count'] ?? 0,
            ];
        }

        return $stats;
    }

    private static function escapeValue(string $value): string
    {
        return '"'.addcslashes($value, '"\\\/').'"';
    }
}
