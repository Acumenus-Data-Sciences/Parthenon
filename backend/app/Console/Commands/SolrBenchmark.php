<?php

namespace App\Console\Commands;

use App\Models\Vocabulary\Concept;
use App\Services\Solr\SolrClientWrapper;
use App\Services\Solr\VocabularySearchService;
use Illuminate\Console\Command;

class SolrBenchmark extends Command
{
    protected $signature = 'solr:benchmark
        {--queries=10 : Number of queries per test}
        {--warmup=2 : Number of warmup queries before timing}';

    protected $description = 'Benchmark vocabulary search: PostgreSQL ILIKE vs Solr. Run before and after Solr setup.';

    /** @var list<array{term: string, domain: string|null, vocabulary: string|null, standard: bool}> */
    private array $testQueries = [
        ['term' => 'diabetes', 'domain' => null, 'vocabulary' => null, 'standard' => false],
        ['term' => 'hypertension', 'domain' => 'Condition', 'vocabulary' => null, 'standard' => true],
        ['term' => 'aspirin', 'domain' => 'Drug', 'vocabulary' => null, 'standard' => false],
        ['term' => 'hemoglobin', 'domain' => null, 'vocabulary' => null, 'standard' => false],
        ['term' => 'heart failure', 'domain' => 'Condition', 'vocabulary' => 'SNOMED', 'standard' => true],
        ['term' => 'blood pressure', 'domain' => 'Measurement', 'vocabulary' => null, 'standard' => false],
        ['term' => 'ibuprofen', 'domain' => null, 'vocabulary' => 'RxNorm', 'standard' => false],
        ['term' => 'covid', 'domain' => null, 'vocabulary' => null, 'standard' => false],
        ['term' => 'myocardial infarction', 'domain' => null, 'vocabulary' => null, 'standard' => true],
        ['term' => 'type 2 diabetes mellitus', 'domain' => 'Condition', 'vocabulary' => null, 'standard' => true],
    ];

    public function handle(SolrClientWrapper $solr, VocabularySearchService $vocabSearch): int
    {
        $numQueries = (int) $this->option('queries');
        $warmup = (int) $this->option('warmup');

        $this->info('=== Parthenon Vocabulary Search Benchmark ===');
        $this->newLine();

        // Count total concepts
        $totalConcepts = Concept::count();
        $this->info("Total concepts in PostgreSQL: {$totalConcepts}");

        $solrAvailable = $solr->isAvailable();
        $solrDocCount = $solrAvailable
            ? $solr->documentCount(config('solr.cores.vocabulary', 'vocabulary'))
            : null;

        $this->info('Solr status: '.($solrAvailable ? "available ({$solrDocCount} docs)" : 'unavailable'));
        $this->newLine();

        // Benchmark PostgreSQL
        $this->info("--- PostgreSQL ILIKE Benchmark ({$numQueries} queries, {$warmup} warmup) ---");
        $pgResults = $this->benchmarkPostgres($numQueries, $warmup);
        $this->renderResults('PostgreSQL', $pgResults);

        // Benchmark Solr (if available)
        if ($solrAvailable) {
            $this->newLine();
            $this->info("--- Solr Benchmark ({$numQueries} queries, {$warmup} warmup) ---");
            $solrResults = $this->benchmarkSolr($vocabSearch, $numQueries, $warmup);
            $this->renderResults('Solr', $solrResults);

            // Comparison
            $this->newLine();
            $this->info('--- Comparison ---');
            $this->table(
                ['Metric', 'PostgreSQL', 'Solr', 'Speedup'],
                [
                    [
                        'Avg (ms)',
                        number_format($pgResults['avg'], 1),
                        number_format($solrResults['avg'], 1),
                        number_format($pgResults['avg'] / max($solrResults['avg'], 0.1), 1).'x',
                    ],
                    [
                        'Median (ms)',
                        number_format($pgResults['median'], 1),
                        number_format($solrResults['median'], 1),
                        number_format($pgResults['median'] / max($solrResults['median'], 0.1), 1).'x',
                    ],
                    [
                        'P95 (ms)',
                        number_format($pgResults['p95'], 1),
                        number_format($solrResults['p95'], 1),
                        number_format($pgResults['p95'] / max($solrResults['p95'], 0.1), 1).'x',
                    ],
                    [
                        'Min (ms)',
                        number_format($pgResults['min'], 1),
                        number_format($solrResults['min'], 1),
                        number_format($pgResults['min'] / max($solrResults['min'], 0.1), 1).'x',
                    ],
                    [
                        'Max (ms)',
                        number_format($pgResults['max'], 1),
                        number_format($solrResults['max'], 1),
                        number_format($pgResults['max'] / max($solrResults['max'], 0.1), 1).'x',
                    ],
                ],
            );
        } else {
            $this->newLine();
            $this->warn('Solr is not available. Run `solr:index-vocabulary` first, then re-run benchmark.');
            $this->info('Baseline PostgreSQL timings saved — re-run after Solr setup to compare.');
        }

        // Save results to JSON for tracking
        $resultsFile = storage_path('app/solr-benchmark-'.date('Y-m-d_His').'.json');
        $data = [
            'timestamp' => now()->toIso8601String(),
            'total_concepts' => $totalConcepts,
            'solr_available' => $solrAvailable,
            'solr_doc_count' => $solrDocCount,
            'num_queries' => $numQueries,
            'postgresql' => $pgResults,
            'solr' => $solrAvailable ? $solrResults : null,
        ];
        file_put_contents($resultsFile, json_encode($data, JSON_PRETTY_PRINT));
        $this->newLine();
        $this->info("Results saved to: {$resultsFile}");

        return self::SUCCESS;
    }

    /**
     * @return array{avg: float, median: float, p95: float, min: float, max: float, timings: list<array{query: string, ms: float, results: int}>}
     */
    private function benchmarkPostgres(int $numQueries, int $warmup): array
    {
        $queries = $this->getQuerySubset($numQueries);
        $timings = [];

        // Warmup
        foreach (array_slice($queries, 0, min($warmup, count($queries))) as $q) {
            $this->runPgQuery($q);
        }

        // Timed runs
        foreach ($queries as $q) {
            $start = microtime(true);
            $result = $this->runPgQuery($q);
            $elapsed = (microtime(true) - $start) * 1000;

            $timings[] = [
                'query' => $q['term'].($q['domain'] ? " [{$q['domain']}]" : '').($q['standard'] ? ' [S]' : ''),
                'ms' => round($elapsed, 2),
                'results' => $result,
            ];
        }

        return $this->calcStats($timings);
    }

    /**
     * @return array{avg: float, median: float, p95: float, min: float, max: float, timings: list<array{query: string, ms: float, results: int}>}
     */
    private function benchmarkSolr(VocabularySearchService $vocabSearch, int $numQueries, int $warmup): array
    {
        $queries = $this->getQuerySubset($numQueries);
        $timings = [];

        // Warmup
        foreach (array_slice($queries, 0, min($warmup, count($queries))) as $q) {
            $vocabSearch->search($q['term'], $this->buildFilters($q));
        }

        // Timed runs
        foreach ($queries as $q) {
            $start = microtime(true);
            $result = $vocabSearch->search($q['term'], $this->buildFilters($q));
            $elapsed = (microtime(true) - $start) * 1000;

            $timings[] = [
                'query' => $q['term'].($q['domain'] ? " [{$q['domain']}]" : '').($q['standard'] ? ' [S]' : ''),
                'ms' => round($elapsed, 2),
                'results' => $result['total'] ?? 0,
            ];
        }

        return $this->calcStats($timings);
    }

    /**
     * @param  array{term: string, domain: string|null, vocabulary: string|null, standard: bool}  $q
     */
    private function runPgQuery(array $q): int
    {
        $query = Concept::query()->search($q['term']);

        if ($q['domain']) {
            $query->inDomain($q['domain']);
        }
        if ($q['vocabulary']) {
            $query->inVocabulary($q['vocabulary']);
        }
        if ($q['standard']) {
            $query->where('standard_concept', 'S');
        }

        return $query->count();
    }

    /**
     * @param  array{term: string, domain: string|null, vocabulary: string|null, standard: bool}  $q
     * @return array<string, mixed>
     */
    private function buildFilters(array $q): array
    {
        $filters = [];
        if ($q['domain']) {
            $filters['domain'] = $q['domain'];
        }
        if ($q['vocabulary']) {
            $filters['vocabulary'] = $q['vocabulary'];
        }
        if ($q['standard']) {
            $filters['standard'] = 'S';
        }

        return $filters;
    }

    /**
     * @return list<array{term: string, domain: string|null, vocabulary: string|null, standard: bool}>
     */
    private function getQuerySubset(int $numQueries): array
    {
        $result = [];
        for ($i = 0; $i < $numQueries; $i++) {
            $result[] = $this->testQueries[$i % count($this->testQueries)];
        }

        return $result;
    }

    /**
     * @param  list<array{query: string, ms: float, results: int}>  $timings
     * @return array{avg: float, median: float, p95: float, min: float, max: float, timings: list<array{query: string, ms: float, results: int}>}
     */
    private function calcStats(array $timings): array
    {
        $ms = array_column($timings, 'ms');
        sort($ms);

        $count = count($ms);

        return [
            'avg' => round(array_sum($ms) / max($count, 1), 2),
            'median' => round($ms[(int) floor($count / 2)] ?? 0, 2),
            'p95' => round($ms[(int) floor($count * 0.95)] ?? end($ms), 2),
            'min' => round(min($ms) ?: 0, 2),
            'max' => round(max($ms) ?: 0, 2),
            'timings' => $timings,
        ];
    }

    /**
     * @param  array{avg: float, median: float, p95: float, min: float, max: float, timings: list<array{query: string, ms: float, results: int}>}  $results
     */
    private function renderResults(string $engine, array $results): void
    {
        $this->table(
            ['Query', 'Time (ms)', 'Results'],
            array_map(fn ($t) => [$t['query'], $t['ms'], number_format($t['results'])], $results['timings']),
        );

        $this->info(sprintf(
            'Stats — Avg: %.1fms | Median: %.1fms | P95: %.1fms | Min: %.1fms | Max: %.1fms',
            $results['avg'],
            $results['median'],
            $results['p95'],
            $results['min'],
            $results['max'],
        ));
    }
}
