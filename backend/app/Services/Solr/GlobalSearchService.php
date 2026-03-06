<?php

namespace App\Services\Solr;

use Illuminate\Support\Facades\Http;

class GlobalSearchService
{
    public function __construct(
        private readonly SolrClientWrapper $solr,
    ) {}

    /**
     * Search across multiple Solr cores simultaneously.
     *
     * @param  list<string>  $types  Filter to specific types: concept, cohort, study
     * @return array{results: list<array<string, mixed>>, totals: array<string, int>}|null
     */
    public function search(string $query, array $types = [], int $limit = 10): ?array
    {
        if (! $this->solr->isAvailable() || trim($query) === '') {
            return null;
        }

        $results = [];
        $totals = [];

        $searchTypes = ! empty($types) ? $types : ['concept', 'cohort', 'study'];
        $host = config('solr.endpoint.default.host', 'solr');
        $port = config('solr.endpoint.default.port', 8983);
        $timeout = (int) config('solr.endpoint.default.timeout', 5);

        // Fan out to cores in parallel using Http::pool
        $responses = Http::pool(function ($pool) use ($searchTypes, $query, $limit, $host, $port, $timeout) {
            foreach ($searchTypes as $type) {
                if ($type === 'concept') {
                    $core = config('solr.cores.vocabulary', 'vocabulary');
                    $params = http_build_query([
                        'q' => $query,
                        'defType' => 'edismax',
                        'qf' => 'concept_name^3 concept_code^2 concept_synonyms^1',
                        'rows' => $limit,
                        'fl' => 'concept_id,concept_name,domain_id,vocabulary_id,concept_class_id,standard_concept',
                        'wt' => 'json',
                    ]);
                    $pool->as('concept')->timeout($timeout)
                        ->get("http://{$host}:{$port}/solr/{$core}/select?{$params}");
                } elseif (in_array($type, ['cohort', 'study'])) {
                    $core = config('solr.cores.cohorts', 'cohorts');
                    $params = http_build_query([
                        'q' => $query,
                        'defType' => 'edismax',
                        'qf' => 'name^3 description^1 tags^2',
                        'fq' => 'type:'.$type,
                        'rows' => $limit,
                        'fl' => 'id,type,name,description,author_name,status,updated_at',
                        'wt' => 'json',
                    ]);
                    $pool->as($type)->timeout($timeout)
                        ->get("http://{$host}:{$port}/solr/{$core}/select?{$params}");
                }
            }
        });

        foreach ($searchTypes as $type) {
            if (! isset($responses[$type]) || ! $responses[$type]->successful()) {
                $totals[$type] = 0;

                continue;
            }

            $data = $responses[$type]->json();
            $docs = $data['response']['docs'] ?? [];
            $total = $data['response']['numFound'] ?? 0;
            $totals[$type] = $total;

            foreach ($docs as $doc) {
                if ($type === 'concept') {
                    $results[] = [
                        'type' => 'concept',
                        'id' => $doc['concept_id'] ?? null,
                        'title' => $doc['concept_name'] ?? '',
                        'subtitle' => ($doc['vocabulary_id'] ?? '').': '.($doc['domain_id'] ?? ''),
                        'url' => '/vocabulary?conceptId='.$doc['concept_id'],
                    ];
                } else {
                    $rawId = $doc['id'] ?? '';
                    $numericId = str_replace("{$type}_", '', $rawId);
                    $results[] = [
                        'type' => $type,
                        'id' => $numericId,
                        'title' => $doc['name'] ?? '',
                        'subtitle' => ($doc['status'] ?? 'draft').' · '.($doc['author_name'] ?? ''),
                        'url' => $type === 'cohort'
                            ? "/cohort-definitions/{$numericId}"
                            : "/studies/{$numericId}",
                    ];
                }
            }
        }

        return [
            'results' => $results,
            'totals' => $totals,
        ];
    }
}
