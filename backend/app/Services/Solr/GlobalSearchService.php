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

        $searchTypes = ! empty($types) ? $types : ['concept', 'cohort', 'study', 'analysis', 'mapping'];
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
                } elseif ($type === 'analysis') {
                    $core = config('solr.cores.analyses', 'analyses');
                    $params = http_build_query([
                        'q' => $query,
                        'defType' => 'edismax',
                        'qf' => 'analysis_name^3 category^2',
                        'rows' => $limit,
                        'fl' => 'id,analysis_id,analysis_name,category,source_id,source_name',
                        'wt' => 'json',
                    ]);
                    $pool->as('analysis')->timeout($timeout)
                        ->get("http://{$host}:{$port}/solr/{$core}/select?{$params}");
                } elseif ($type === 'mapping') {
                    $core = config('solr.cores.mappings', 'mappings');
                    $params = http_build_query([
                        'q' => $query,
                        'defType' => 'edismax',
                        'qf' => 'source_code_text^3 source_description^2 target_concept_name^2',
                        'rows' => $limit,
                        'fl' => 'id,ingestion_job_id,source_code,source_description,target_concept_name,review_tier,confidence',
                        'wt' => 'json',
                    ]);
                    $pool->as('mapping')->timeout($timeout)
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
                } elseif ($type === 'analysis') {
                    $sourceId = $doc['source_id'] ?? 1;
                    $results[] = [
                        'type' => 'analysis',
                        'id' => $doc['analysis_id'] ?? null,
                        'title' => $doc['analysis_name'] ?? '',
                        'subtitle' => ($doc['category'] ?? '').($doc['source_name'] ? ' · '.$doc['source_name'] : ''),
                        'url' => "/data-explorer?source={$sourceId}&analysis={$doc['analysis_id']}",
                    ];
                } elseif ($type === 'mapping') {
                    $jobId = $doc['ingestion_job_id'] ?? 0;
                    $results[] = [
                        'type' => 'mapping',
                        'id' => $doc['id'] ?? null,
                        'title' => ($doc['source_code'] ?? '').' — '.($doc['source_description'] ?? ''),
                        'subtitle' => 'Maps to: '.($doc['target_concept_name'] ?? 'unmapped').' · '.($doc['review_tier'] ?? ''),
                        'url' => "/ingestion/jobs/{$jobId}/review",
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
