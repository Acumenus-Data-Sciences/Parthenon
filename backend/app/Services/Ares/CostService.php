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
     * Get cost aggregates by domain for a source.
     *
     * @return array{has_cost_data: bool, domains: array<int, array{domain: string, total_cost: float, record_count: int, avg_cost: float}>}
     */
    public function getSummary(Source $source): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'domains' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost')
                ->selectRaw('
                    cost_domain_id as domain,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count,
                    AVG(total_charge) as avg_cost
                ')
                ->whereNotNull('cost_domain_id')
                ->groupBy('cost_domain_id')
                ->orderByDesc(DB::raw('SUM(total_charge)'))
                ->get();

            $domains = $results->map(fn ($row) => [
                'domain' => $row->domain,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
                'avg_cost' => round((float) $row->avg_cost, 2),
            ])->toArray();

            return ['has_cost_data' => true, 'domains' => $domains];
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
    public function getTrends(Source $source): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'months' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost')
                ->selectRaw("
                    TO_CHAR(cost_event_date, 'YYYY-MM') as month,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count
                ")
                ->whereNotNull('cost_event_date')
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
     * Get the OMOP connection name for a source, setting search_path as needed.
     */
    private function getOmopConnection(Source $source): string
    {
        if (! empty($source->db_host)) {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Cdm->value)->first();
            $schema = $daimon?->table_qualifier ?? 'omop';

            return $this->connectionFactory->connectionForSchema($source, $schema);
        }

        return 'omop';
    }
}
