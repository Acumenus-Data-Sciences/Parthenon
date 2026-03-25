<?php

declare(strict_types=1);

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CostService
{
    /**
     * Domain tables that can have associated cost records.
     *
     * @var list<string>
     */
    private const COST_DOMAINS = [
        'drug_exposure',
        'procedure_occurrence',
        'visit_occurrence',
        'device_exposure',
        'condition_occurrence',
        'measurement',
        'observation',
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Check if a source has any cost data.
     */
    public function hasCostData(Source $source): bool
    {
        try {
            $connection = $this->getOmopConnection($source);

            $count = DB::connection($connection)
                ->table('cost')
                ->limit(1)
                ->count();

            return $count > 0;
        } catch (\Throwable $e) {
            Log::debug("CostService: cost table check failed for source {$source->source_name}: {$e->getMessage()}");

            return false;
        }
    }

    /**
     * Get a warning message if multiple cost types exist.
     */
    public function getCostTypeWarning(Source $source): ?string
    {
        $types = $this->getAvailableCostTypes($source);

        if (count($types) <= 1) {
            return null;
        }

        $typeNames = array_map(fn (array $t) => $t['concept_name'], $types);

        return sprintf(
            'This source contains %d cost types (%s). Mixing types can distort analysis by 3-10x. Filter to a single type.',
            count($types),
            implode(', ', $typeNames),
        );
    }

    /**
     * Get cost aggregates by domain for a source.
     *
     * @return array{has_cost_data: bool, domains: array<int, array{domain: string, total_cost: float, record_count: int, avg_cost: float}>, total_cost?: float, person_count?: int, avg_observation_years?: float, pppy?: float, cost_type_warning?: string|null}
     */
    public function getSummary(Source $source, ?int $costTypeConceptId = null): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'domains' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $query = DB::connection($connection)
                ->table('cost')
                ->selectRaw('
                    cost_domain_id as domain,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count,
                    AVG(total_charge) as avg_cost
                ')
                ->whereNotNull('cost_domain_id');

            if ($costTypeConceptId !== null) {
                $query->where('cost_type_concept_id', $costTypeConceptId);
            }

            $results = $query
                ->groupBy('cost_domain_id')
                ->orderByDesc(DB::raw('SUM(total_charge)'))
                ->get();

            $domains = $results->map(fn ($row) => [
                'domain' => $row->domain,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
                'avg_cost' => round((float) $row->avg_cost, 2),
            ])->toArray();

            // Compute PPPY (per-patient-per-year)
            $totalCost = array_sum(array_column($domains, 'total_cost'));

            // Get person count from Achilles analysis 1
            $personResult = DB::connection($connection)
                ->table('achilles_results')
                ->where('analysis_id', 1)
                ->value('count_value');
            $personCount = (int) ($personResult ?? 0);

            // Get average observation years from observation_period table
            $avgObsYears = 1.0; // default
            try {
                $avgObsDays = DB::connection($connection)
                    ->table('observation_period')
                    ->selectRaw('AVG(observation_period_end_date - observation_period_start_date) as avg_days')
                    ->value('avg_days');
                if ($avgObsDays && (float) $avgObsDays > 0) {
                    $avgObsYears = max(0.1, round((float) $avgObsDays / 365.25, 2));
                }
            } catch (\Throwable) {
                // Fall back to 1 year if obs_period not accessible
            }

            $pppy = ($personCount > 0 && $avgObsYears > 0)
                ? round($totalCost / $personCount / $avgObsYears, 2)
                : 0;

            return [
                'has_cost_data' => true,
                'domains' => $domains,
                'total_cost' => round($totalCost, 2),
                'person_count' => $personCount,
                'avg_observation_years' => $avgObsYears,
                'pppy' => $pppy,
                'cost_type_warning' => $this->getCostTypeWarning($source),
            ];
        } catch (\Throwable $e) {
            Log::warning("CostService: getSummary failed for source {$source->source_name}: {$e->getMessage()}");

            return ['has_cost_data' => false, 'domains' => []];
        }
    }

    /**
     * Get monthly cost totals for a source.
     *
     * @return array{has_cost_data: bool, months: array<int, array{month: string, total_cost: float, record_count: int}>}
     */
    public function getTrends(Source $source, ?int $costTypeConceptId = null): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'months' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $query = DB::connection($connection)
                ->table('cost')
                ->selectRaw("
                    TO_CHAR(cost_event_date, 'YYYY-MM') as month,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count
                ")
                ->whereNotNull('cost_event_date');

            if ($costTypeConceptId !== null) {
                $query->where('cost_type_concept_id', $costTypeConceptId);
            }

            $results = $query
                ->groupByRaw("TO_CHAR(cost_event_date, 'YYYY-MM')")
                ->orderBy(DB::raw("TO_CHAR(cost_event_date, 'YYYY-MM')"))
                ->get();

            $months = $results->map(fn ($row) => [
                'month' => $row->month,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
            ])->toArray();

            return ['has_cost_data' => true, 'months' => $months];
        } catch (\Throwable $e) {
            Log::warning("CostService: getTrends failed for source {$source->source_name}: {$e->getMessage()}");

            return ['has_cost_data' => false, 'months' => []];
        }
    }

    /**
     * Get top cost concepts within a domain for a source.
     *
     * @return array{has_cost_data: bool, concepts: array<int, array{concept_id: int, concept_name: string, total_cost: float, record_count: int}>}
     */
    public function getDomainDetail(Source $source, string $domain): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'concepts' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost as c')
                ->join('concept as co', 'c.cost_concept_id', '=', 'co.concept_id')
                ->selectRaw('
                    c.cost_concept_id as concept_id,
                    co.concept_name,
                    SUM(c.total_charge) as total_cost,
                    COUNT(*) as record_count
                ')
                ->where('c.cost_domain_id', $domain)
                ->groupBy('c.cost_concept_id', 'co.concept_name')
                ->orderByDesc(DB::raw('SUM(c.total_charge)'))
                ->limit(50)
                ->get();

            $concepts = $results->map(fn ($row) => [
                'concept_id' => (int) $row->concept_id,
                'concept_name' => $row->concept_name,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
            ])->toArray();

            return ['has_cost_data' => true, 'concepts' => $concepts];
        } catch (\Throwable $e) {
            Log::warning("CostService: getDomainDetail failed for source {$source->source_name}: {$e->getMessage()}");

            return ['has_cost_data' => false, 'concepts' => []];
        }
    }

    /**
     * Get aggregated cost data across all sources.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, has_cost_data: bool, total_cost: float, record_count: int}>}
     */
    public function getNetworkCost(): array
    {
        return Cache::remember('ares:network:cost', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                $summary = $this->getSummary($source);
                $totalCost = array_sum(array_column($summary['domains'], 'total_cost'));
                $totalRecords = array_sum(array_column($summary['domains'], 'record_count'));

                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'has_cost_data' => $summary['has_cost_data'],
                    'total_cost' => round($totalCost, 2),
                    'record_count' => $totalRecords,
                ];
            }

            return ['sources' => $results];
        });
    }

    /**
     * Get cost distribution data for box-and-whisker plots.
     *
     * @return array{has_cost_data: bool, distributions: array<int, array{domain: string, min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float, mean: float, count: int}>}
     */
    public function getDistribution(Source $source, ?string $domain = null, ?int $costTypeConceptId = null): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'distributions' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $query = DB::connection($connection)->table('cost')
                ->whereNotNull('cost_domain_id')
                ->where('total_charge', '>', 0);

            if ($domain) {
                $query->where('cost_domain_id', $domain);
            }

            if ($costTypeConceptId) {
                $query->where('cost_type_concept_id', $costTypeConceptId);
            }

            $distributions = $query
                ->selectRaw('
                    cost_domain_id as domain,
                    MIN(total_charge) as min_val,
                    PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY total_charge) as p10,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_charge) as p25,
                    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_charge) as median,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_charge) as p75,
                    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_charge) as p90,
                    MAX(total_charge) as max_val,
                    AVG(total_charge) as mean_val,
                    COUNT(*) as record_count
                ')
                ->groupBy('cost_domain_id')
                ->orderByDesc(DB::raw('SUM(total_charge)'))
                ->get();

            return [
                'has_cost_data' => true,
                'distributions' => $distributions->map(fn ($row) => [
                    'domain' => $row->domain,
                    'min' => round((float) $row->min_val, 2),
                    'p10' => round((float) $row->p10, 2),
                    'p25' => round((float) $row->p25, 2),
                    'median' => round((float) $row->median, 2),
                    'p75' => round((float) $row->p75, 2),
                    'p90' => round((float) $row->p90, 2),
                    'max' => round((float) $row->max_val, 2),
                    'mean' => round((float) $row->mean_val, 2),
                    'count' => (int) $row->record_count,
                ])->toArray(),
            ];
        } catch (\Throwable $e) {
            Log::warning("CostService: getDistribution failed: {$e->getMessage()}");

            return ['has_cost_data' => false, 'distributions' => []];
        }
    }

    /**
     * Get distinct cost type concept IDs available for a source.
     *
     * @return array<int, array{cost_type_concept_id: int, concept_name: string, record_count: int}>
     */
    public function getAvailableCostTypes(Source $source): array
    {
        try {
            $connection = $this->getOmopConnection($source);

            $types = DB::connection($connection)->table('cost as c')
                ->join('concept as co', 'c.cost_type_concept_id', '=', 'co.concept_id')
                ->whereNotNull('c.cost_type_concept_id')
                ->selectRaw('c.cost_type_concept_id, co.concept_name, COUNT(*) as record_count')
                ->groupBy('c.cost_type_concept_id', 'co.concept_name')
                ->orderByDesc(DB::raw('COUNT(*)'))
                ->get();

            return $types->map(fn ($row) => [
                'cost_type_concept_id' => (int) $row->cost_type_concept_id,
                'concept_name' => $row->concept_name,
                'record_count' => (int) $row->record_count,
            ])->toArray();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Get care setting breakdown — cost grouped by visit type.
     *
     * @return array{has_cost_data: bool, settings: array<int, array{setting: string, visit_concept_id: int, total_cost: float, record_count: int, avg_cost: float}>}
     */
    public function getCareSettingBreakdown(Source $source): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'settings' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)->table('cost as c')
                ->join('visit_occurrence as vo', function ($join) {
                    $join->on('c.cost_event_id', '=', 'vo.visit_occurrence_id')
                        ->where('c.cost_domain_id', '=', 'Visit');
                })
                ->join('concept as co', 'vo.visit_concept_id', '=', 'co.concept_id')
                ->selectRaw('
                    co.concept_name as setting,
                    vo.visit_concept_id,
                    SUM(c.total_charge) as total_cost,
                    COUNT(*) as record_count,
                    AVG(c.total_charge) as avg_cost
                ')
                ->groupBy('co.concept_name', 'vo.visit_concept_id')
                ->orderByDesc(DB::raw('SUM(c.total_charge)'))
                ->get();

            return [
                'has_cost_data' => true,
                'settings' => $results->map(fn ($row) => [
                    'setting' => $row->setting,
                    'visit_concept_id' => (int) $row->visit_concept_id,
                    'total_cost' => round((float) $row->total_cost, 2),
                    'record_count' => (int) $row->record_count,
                    'avg_cost' => round((float) $row->avg_cost, 2),
                ])->toArray(),
            ];
        } catch (\Throwable $e) {
            Log::warning("CostService: getCareSettingBreakdown failed: {$e->getMessage()}");

            return ['has_cost_data' => false, 'settings' => []];
        }
    }

    /**
     * Get network cost comparison across all sources.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, has_cost_data: bool, total_cost: float, pppy: float, person_count: int}>}
     */
    public function getNetworkCompare(): array
    {
        return Cache::remember('ares:network:cost-compare', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                $summary = $this->getSummary($source);

                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'has_cost_data' => $summary['has_cost_data'],
                    'total_cost' => $summary['total_cost'] ?? 0.0,
                    'pppy' => $summary['pppy'] ?? 0.0,
                    'person_count' => $summary['person_count'] ?? 0,
                ];
            }

            return ['sources' => $results];
        });
    }

    /**
     * Get per-source cost distribution stats for cross-source comparison.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, has_cost_data: bool, distribution: array{min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float}|null}>}
     */
    public function getNetworkCostComparison(string $domain, ?int $costTypeConceptId = null): array
    {
        $cacheKey = "ares:network:cost-compare-detailed:{$domain}:".($costTypeConceptId ?? 'all');

        return Cache::remember($cacheKey, 600, function () use ($domain, $costTypeConceptId) {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                if (! $this->hasCostData($source)) {
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'has_cost_data' => false,
                        'distribution' => null,
                    ];

                    continue;
                }

                try {
                    $connection = $this->getOmopConnection($source);

                    $query = DB::connection($connection)->table('cost')
                        ->where('total_charge', '>', 0);

                    if ($domain !== 'all') {
                        $query->where('cost_domain_id', $domain);
                    }

                    if ($costTypeConceptId) {
                        $query->where('cost_type_concept_id', $costTypeConceptId);
                    }

                    $stats = $query->selectRaw('
                        MIN(total_charge) as min_val,
                        PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY total_charge) as p10,
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_charge) as p25,
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_charge) as median,
                        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_charge) as p75,
                        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_charge) as p90,
                        MAX(total_charge) as max_val,
                        COUNT(*) as record_count
                    ')->first();

                    if (! $stats || (int) $stats->record_count === 0) {
                        $results[] = [
                            'source_id' => $source->id,
                            'source_name' => $source->source_name,
                            'has_cost_data' => false,
                            'distribution' => null,
                        ];

                        continue;
                    }

                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'has_cost_data' => true,
                        'distribution' => [
                            'min' => round((float) $stats->min_val, 2),
                            'p10' => round((float) $stats->p10, 2),
                            'p25' => round((float) $stats->p25, 2),
                            'median' => round((float) $stats->median, 2),
                            'p75' => round((float) $stats->p75, 2),
                            'p90' => round((float) $stats->p90, 2),
                            'max' => round((float) $stats->max_val, 2),
                        ],
                    ];
                } catch (\Throwable $e) {
                    Log::warning("CostService: getNetworkCostComparison failed for source {$source->source_name}: {$e->getMessage()}");
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'has_cost_data' => false,
                        'distribution' => null,
                    ];
                }
            }

            return ['sources' => $results];
        });
    }

    /**
     * Get top cost-driving concepts for a source.
     *
     * @return array{has_cost_data: bool, drivers: array<int, array{concept_id: int, concept_name: string, domain: string, total_cost: float, record_count: int, patient_count: int, pct_of_total: float}>}
     */
    public function getCostDrivers(Source $source, int $limit = 10): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'drivers' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            // Get total cost for percentage calculation
            $totalCost = (float) DB::connection($connection)->table('cost')
                ->where('total_charge', '>', 0)
                ->sum('total_charge');

            if ($totalCost <= 0) {
                return ['has_cost_data' => false, 'drivers' => []];
            }

            // Get top concepts by total cost, joining to concept for names
            $results = DB::connection($connection)->table('cost as c')
                ->join('concept as co', 'c.cost_concept_id', '=', 'co.concept_id')
                ->selectRaw('
                    c.cost_concept_id as concept_id,
                    co.concept_name,
                    c.cost_domain_id as domain,
                    SUM(c.total_charge) as total_cost,
                    COUNT(*) as record_count,
                    COUNT(DISTINCT c.person_id) as patient_count
                ')
                ->where('c.total_charge', '>', 0)
                ->whereNotNull('c.cost_concept_id')
                ->where('c.cost_concept_id', '!=', 0)
                ->groupBy('c.cost_concept_id', 'co.concept_name', 'c.cost_domain_id')
                ->orderByDesc(DB::raw('SUM(c.total_charge)'))
                ->limit($limit)
                ->get();

            $drivers = $results->map(fn ($row) => [
                'concept_id' => (int) $row->concept_id,
                'concept_name' => $row->concept_name,
                'domain' => $row->domain ?? 'Unknown',
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
                'patient_count' => (int) $row->patient_count,
                'pct_of_total' => round(((float) $row->total_cost / $totalCost) * 100, 1),
            ])->toArray();

            return ['has_cost_data' => true, 'drivers' => $drivers];
        } catch (\Throwable $e) {
            Log::warning("CostService: getCostDrivers failed for source {$source->source_name}: {$e->getMessage()}");

            return ['has_cost_data' => false, 'drivers' => []];
        }
    }

    /**
     * Get the OMOP connection name for a source, setting search_path as needed.
     */
    private function getOmopConnection(Source $source): string
    {
        if (! empty($source->db_host)) {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::CDM->value)->first();
            $schema = $daimon?->table_qualifier ?? 'omop';

            return $this->connectionFactory->connectionForSchema($source, $schema);
        }

        return 'omop';
    }
}
