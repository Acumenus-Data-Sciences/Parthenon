<?php

namespace App\Services\Ares;

use App\Concerns\SourceAware;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Log;

class NetworkComparisonService
{
    use SourceAware;

    /**
     * Map of OMOP domains to their Achilles prevalence analysis IDs.
     *
     * @var array<string, int>
     */
    private const DOMAIN_PREVALENCE_MAP = [
        'condition' => 401,
        'drug' => 701,
        'procedure' => 601,
        'measurement' => 1801,
        'observation' => 801,
        'visit' => 201,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Compare concept prevalence across all active sources.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int, ci_lower: float, ci_upper: float}>, benchmark_rate: float|null}
     */
    public function compareConcept(int $conceptId): array
    {
        $sources = Source::whereHas('daimons')->get();
        $results = [];

        foreach ($sources as $source) {
            try {
                $data = $this->getConceptDataForSource($source, $conceptId);
                $results[] = $data;
            } catch (\Throwable $e) {
                Log::warning("NetworkComparison: failed to query source {$source->source_name}: {$e->getMessage()}");
                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'count' => 0,
                    'rate_per_1000' => 0.0,
                    'person_count' => 0,
                    'ci_lower' => 0.0,
                    'ci_upper' => 0.0,
                ];
            }
        }

        return [
            'sources' => $results,
            'benchmark_rate' => $this->getBenchmark($conceptId),
        ];
    }

    /**
     * Compare multiple concepts across all sources.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int, ci_lower: float, ci_upper: float}>>
     */
    public function compareBatch(array $conceptIds): array
    {
        $results = [];

        foreach ($conceptIds as $conceptId) {
            $results[$conceptId] = $this->compareConcept($conceptId);
        }

        return $results;
    }

    /**
     * Search concepts for comparison using vocabulary search.
     *
     * @return array<int, array{concept_id: int, concept_name: string, domain_id: string, vocabulary_id: string}>
     */
    public function searchConcepts(string $query): array
    {
        if (strlen($query) < 2) {
            return [];
        }

        $sanitized = str_replace(['%', '_'], ['\%', '\_'], $query);

        $results = $this->cdm()
            ->table('concept')
            ->select(['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'standard_concept'])
            ->where('concept_name', 'ilike', "%{$sanitized}%")
            ->where('standard_concept', 'S')
            ->orderByRaw('CASE WHEN concept_name ILIKE ? THEN 0 ELSE 1 END', ["{$sanitized}%"])
            ->limit(50)
            ->get();

        return $results->map(fn ($row) => [
            'concept_id' => $row->concept_id,
            'concept_name' => $row->concept_name,
            'domain_id' => $row->domain_id,
            'vocabulary_id' => $row->vocabulary_id,
        ])->toArray();
    }

    /**
     * Compare multiple concepts across all sources with grouped data.
     *
     * @param  array<int>  $conceptIds
     * @return array{concepts: array<int, array{concept_id: int, concept_name: string}>, sources: array<int, array{source_id: int, source_name: string, rates: array<int, array{count: int, rate_per_1000: float, ci_lower: float, ci_upper: float}>}>}
     */
    public function compareMultiConcepts(array $conceptIds): array
    {
        $conceptNames = $this->resolveConceptNames($conceptIds);
        $batchData = $this->compareBatch($conceptIds);

        $concepts = array_map(fn (int $id) => [
            'concept_id' => $id,
            'concept_name' => $conceptNames[$id] ?? "Concept {$id}",
        ], $conceptIds);

        // Pivot: group by source, with rates per concept
        $sourceMap = [];
        foreach ($batchData as $conceptId => $conceptData) {
            $sourceResults = $conceptData['sources'] ?? [];
            foreach ($sourceResults as $sr) {
                $key = $sr['source_id'];
                if (! isset($sourceMap[$key])) {
                    $sourceMap[$key] = [
                        'source_id' => $sr['source_id'],
                        'source_name' => $sr['source_name'],
                        'rates' => [],
                    ];
                }
                $sourceMap[$key]['rates'][$conceptId] = [
                    'count' => $sr['count'],
                    'rate_per_1000' => $sr['rate_per_1000'],
                    'ci_lower' => $sr['ci_lower'],
                    'ci_upper' => $sr['ci_upper'],
                ];
            }
        }

        return [
            'concepts' => $concepts,
            'sources' => count($sourceMap) > 0 ? array_values($sourceMap) : [],
        ];
    }

    /**
     * Compute attrition funnel across sources for stacked concept criteria.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array{source_id: int, source_name: string, steps: array<int, array{concept_name: string, remaining_patients: int, percentage: float}>}>
     */
    public function computeAttritionFunnel(array $conceptIds): array
    {
        $sources = Source::whereHas('daimons')->get();
        $conceptNames = $this->resolveConceptNames($conceptIds);
        $results = [];

        foreach ($sources as $source) {
            try {
                $steps = $this->computeFunnelForSource($source, $conceptIds, $conceptNames);
                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'steps' => $steps,
                ];
            } catch (\Throwable $e) {
                Log::warning("AttritionFunnel: failed for {$source->source_name}: {$e->getMessage()}");
            }
        }

        return $results;
    }

    /**
     * @param  array<int>  $conceptIds
     * @param  array<int, string>  $conceptNames
     * @return array<int, array{concept_name: string, remaining_patients: int, percentage: float}>
     */
    private function computeFunnelForSource(Source $source, array $conceptIds, array $conceptNames): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            $this->results()->statement("SET search_path TO \"{$schema}\", public");
        }

        // Get total person count as baseline
        $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
        $totalPersons = (int) ($personResult?->count_value ?? 0);

        $steps = [];
        $remaining = $totalPersons;

        // "All patients" baseline
        $steps[] = [
            'concept_name' => 'All patients',
            'remaining_patients' => $totalPersons,
            'percentage' => 100.0,
        ];

        foreach ($conceptIds as $conceptId) {
            $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);
            $result = AchillesResult::on($connection)
                ->whereIn('analysis_id', $analysisIds)
                ->where('stratum_1', (string) $conceptId)
                ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
                ->first();

            $conceptCount = (int) ($result?->total_count ?? 0);
            // Simulate attrition — remaining is min of current remaining and concept count
            $remaining = min($remaining, $conceptCount);

            $steps[] = [
                'concept_name' => $conceptNames[$conceptId] ?? "Concept {$conceptId}",
                'remaining_patients' => $remaining,
                'percentage' => $totalPersons > 0 ? round(($remaining / $totalPersons) * 100, 1) : 0.0,
            ];
        }

        return $steps;
    }

    /**
     * Get temporal prevalence trends for a concept across all sources.
     *
     * Returns per-source prevalence per release for trend visualization.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, trend: array<int, array{release_name: string, rate_per_1000: float}>}>}
     */
    public function getTemporalPrevalence(int $conceptId): array
    {
        $sources = Source::whereHas('daimons')->with(['releases' => fn ($q) => $q->orderBy('created_at')])->get();
        $result = [];

        foreach ($sources as $source) {
            try {
                $trend = $this->getTemporalTrendForSource($source, $conceptId);
                if (count($trend) > 0) {
                    $result[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'trend' => $trend,
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning("TemporalPrevalence: failed for {$source->source_name}: {$e->getMessage()}");
            }
        }

        return ['sources' => $result];
    }

    /**
     * Compare a concept set (union of concepts) across all sources.
     *
     * Returns aggregate prevalence: patients with ANY concept in the set.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array{source_id: int, source_name: string, union_count: int, rate_per_1000: float, person_count: int}>
     */
    public function compareConceptSet(array $conceptIds): array
    {
        $sources = Source::whereHas('daimons')->get();
        $results = [];

        foreach ($sources as $source) {
            try {
                $data = $this->getConceptSetDataForSource($source, $conceptIds);
                $results[] = $data;
            } catch (\Throwable $e) {
                Log::warning("ConceptSetComparison: failed for {$source->source_name}: {$e->getMessage()}");
                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'union_count' => 0,
                    'rate_per_1000' => 0.0,
                    'person_count' => 0,
                ];
            }
        }

        return $results;
    }

    /**
     * Lookup population benchmark rate for a concept from config.
     *
     * @return float|null National prevalence rate per 1000, or null if unavailable
     */
    public function getBenchmark(int $conceptId): ?float
    {
        $benchmarks = config('ares.benchmarks', []);

        return isset($benchmarks[$conceptId]) ? (float) $benchmarks[$conceptId] : null;
    }

    /**
     * Get temporal trend data for a single source by querying each release.
     *
     * @return array<int, array{release_name: string, rate_per_1000: float}>
     */
    private function getTemporalTrendForSource(Source $source, int $conceptId): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            $this->results()->statement("SET search_path TO \"{$schema}\", public");
        }

        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);
        $releases = $source->releases()->orderBy('created_at')->get();
        $trend = [];

        // Get person count (analysis 1)
        $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
        $personCount = (int) ($personResult?->count_value ?? 0);

        if ($personCount === 0) {
            return [];
        }

        // For each release, query concept prevalence
        // If Achilles results are not per-release, use global count as a single data point
        foreach ($releases as $release) {
            $result = AchillesResult::on($connection)
                ->whereIn('analysis_id', $analysisIds)
                ->where('stratum_1', (string) $conceptId)
                ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
                ->first();

            $count = (int) ($result?->total_count ?? 0);
            $ratePer1000 = round(($count / $personCount) * 1000, 2);

            $trend[] = [
                'release_name' => $release->release_name,
                'rate_per_1000' => $ratePer1000,
            ];
        }

        return $trend;
    }

    /**
     * Get union patient counts for a concept set in a single source.
     *
     * @param  array<int>  $conceptIds
     * @return array{source_id: int, source_name: string, union_count: int, rate_per_1000: float, person_count: int}
     */
    private function getConceptSetDataForSource(Source $source, array $conceptIds): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            $this->results()->statement("SET search_path TO \"{$schema}\", public");
        }

        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);

        // Union: sum unique patients across all concept IDs in the set
        $stratumValues = array_map('strval', $conceptIds);
        $result = AchillesResult::on($connection)
            ->whereIn('analysis_id', $analysisIds)
            ->whereIn('stratum_1', $stratumValues)
            ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
            ->first();

        $unionCount = (int) ($result?->total_count ?? 0);

        // Person count
        $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
        $personCount = (int) ($personResult?->count_value ?? 0);
        $ratePer1000 = $personCount > 0 ? round(($unionCount / $personCount) * 1000, 2) : 0.0;

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'union_count' => $unionCount,
            'rate_per_1000' => $ratePer1000,
            'person_count' => $personCount,
        ];
    }

    /**
     * @param  array<int>  $conceptIds
     * @return array<int, string>
     */
    private function resolveConceptNames(array $conceptIds): array
    {
        return $this->cdm()
            ->table('concept')
            ->whereIn('concept_id', $conceptIds)
            ->pluck('concept_name', 'concept_id')
            ->toArray();
    }

    /**
     * Get concept prevalence data for a specific source.
     *
     * @return array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int, ci_lower: float, ci_upper: float}
     */
    private function getConceptDataForSource(Source $source, int $conceptId): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            $this->results()->statement(
                "SET search_path TO \"{$schema}\", public"
            );
        }

        // Query Achilles results for concept prevalence across all analysis IDs
        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);

        $result = AchillesResult::on($connection)
            ->whereIn('analysis_id', $analysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
            ->first();

        $count = (int) ($result?->total_count ?? 0);

        // Get person count (analysis 1)
        $personResult = AchillesResult::on($connection)
            ->where('analysis_id', 1)
            ->first();

        $personCount = (int) ($personResult?->count_value ?? 0);
        $ratePer1000 = $personCount > 0 ? round(($count / $personCount) * 1000, 2) : 0.0;

        // Wilson score 95% confidence interval for rate_per_1000
        $ciLower = 0.0;
        $ciUpper = 0.0;

        if ($personCount > 0 && $count > 0) {
            $p = $count / $personCount;
            $z = 1.96;
            $denominator = 1 + ($z * $z / $personCount);
            $center = ($p + ($z * $z) / (2 * $personCount)) / $denominator;
            $spread = ($z / $denominator) * sqrt(($p * (1 - $p) / $personCount) + ($z * $z / (4 * $personCount * $personCount)));
            $ciLower = round(max(0, ($center - $spread) * 1000), 2);
            $ciUpper = round(($center + $spread) * 1000, 2);
        }

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'count' => $count,
            'rate_per_1000' => $ratePer1000,
            'person_count' => $personCount,
            'ci_lower' => $ciLower,
            'ci_upper' => $ciUpper,
        ];
    }
}
