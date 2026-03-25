<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CoverageService
{
    /**
     * Standard CDM domains and their Achilles count analysis IDs.
     *
     * @var array<string, int>
     */
    private const DOMAIN_COUNT_MAP = [
        'person' => 1,
        'condition_occurrence' => 400,
        'drug_exposure' => 700,
        'procedure_occurrence' => 600,
        'measurement' => 1800,
        'observation' => 800,
        'visit_occurrence' => 200,
        'death' => 500,
    ];

    /**
     * Expected domain coverage by source type.
     * true = expected to have data, false = typically missing.
     *
     * @var array<string, array<string, bool>>
     */
    private const EXPECTED_COVERAGE = [
        'claims' => [
            'person' => true, 'condition_occurrence' => true, 'drug_exposure' => true,
            'procedure_occurrence' => true, 'measurement' => false, 'observation' => false,
            'visit_occurrence' => true, 'death' => true,
        ],
        'ehr' => [
            'person' => true, 'condition_occurrence' => true, 'drug_exposure' => true,
            'procedure_occurrence' => true, 'measurement' => true, 'observation' => true,
            'visit_occurrence' => true, 'death' => true,
        ],
        'registry' => [
            'person' => true, 'condition_occurrence' => true, 'drug_exposure' => false,
            'procedure_occurrence' => false, 'measurement' => true, 'observation' => true,
            'visit_occurrence' => false, 'death' => true,
        ],
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Build the domain x source coverage matrix.
     *
     * @return array{sources: array<int, array{id: int, name: string}>, domains: string[], matrix: array<int, array<string, array{record_count: int, has_data: bool, density_per_person: float}>>, domain_totals: array<string, int>, source_completeness: array<int, int>}
     */
    public function getMatrix(): array
    {
        return Cache::remember('ares:network:coverage', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $domains = array_keys(self::DOMAIN_COUNT_MAP);

            $sourceList = $sources->map(fn (Source $s) => [
                'id' => $s->id,
                'name' => $s->source_name,
            ])->values()->toArray();

            $matrix = [];

            foreach ($sources as $source) {
                $counts = $this->getSourceDomainCounts($source);
                $personCount = $counts['person'] ?? 0;

                $row = [];
                foreach ($domains as $domain) {
                    $count = $counts[$domain] ?? 0;
                    $row[$domain] = [
                        'record_count' => $count,
                        'has_data' => $count > 0,
                        'density_per_person' => $personCount > 0
                            ? round($count / $personCount, 2)
                            : 0.0,
                    ];
                }
                $matrix[] = $row;
            }

            // Domain totals: sum record_count across all sources per domain
            $domainTotals = [];
            foreach ($domains as $domain) {
                $total = 0;
                foreach ($matrix as $row) {
                    $total += $row[$domain]['record_count'] ?? 0;
                }
                $domainTotals[$domain] = $total;
            }

            // Source completeness: count domains with data per source
            $sourceCompleteness = [];
            foreach ($sources as $idx => $source) {
                $count = 0;
                foreach ($domains as $domain) {
                    if ($matrix[$idx][$domain]['has_data'] ?? false) {
                        $count++;
                    }
                }
                $sourceCompleteness[$source->id] = $count;
            }

            return [
                'sources' => $sourceList,
                'domains' => $domains,
                'matrix' => $matrix,
                'domain_totals' => $domainTotals,
                'source_completeness' => $sourceCompleteness,
            ];
        });
    }

    /**
     * Extended matrix with temporal extent per cell and expected coverage benchmarks.
     *
     * @return array{sources: array<int, array{id: int, name: string, source_type: string|null}>, domains: string[], matrix: array<int, array<string, array{record_count: int, has_data: bool, density_per_person: float, earliest_date: string|null, latest_date: string|null}>>, domain_totals: array<string, int>, source_completeness: array<int, int>, expected: array<string, array<string, bool>>}
     */
    public function getExtendedMatrix(): array
    {
        return Cache::remember('ares:network:coverage:extended', 600, function () {
            $base = $this->getMatrix();

            $sources = Source::whereHas('daimons')->get();

            // Enrich source list with source_type
            foreach ($sources as $index => $source) {
                $base['sources'][$index]['source_type'] = $source->source_type;
            }

            // Query observation_period for temporal extent per source
            foreach ($sources as $index => $source) {
                $temporal = $this->getTemporalExtent($source);

                foreach ($base['domains'] as $domain) {
                    if (isset($base['matrix'][$index][$domain])) {
                        $base['matrix'][$index][$domain]['earliest_date'] = $temporal['earliest'] ?? null;
                        $base['matrix'][$index][$domain]['latest_date'] = $temporal['latest'] ?? null;
                    }
                }
            }

            $base['expected'] = self::EXPECTED_COVERAGE;

            return $base;
        });
    }

    /**
     * Get the earliest and latest observation dates for a source.
     *
     * @return array{earliest: string|null, latest: string|null}
     */
    private function getTemporalExtent(Source $source): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                DB::connection('results')->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            // Analysis 111 = observation period start dates, 112 = end dates
            $earliest = AchillesResult::on($connection)
                ->where('analysis_id', 111)
                ->orderBy('stratum_1')
                ->first();

            $latest = AchillesResult::on($connection)
                ->where('analysis_id', 112)
                ->orderByDesc('stratum_1')
                ->first();

            return [
                'earliest' => $earliest?->stratum_1,
                'latest' => $latest?->stratum_1,
            ];
        } catch (\Throwable $e) {
            Log::warning("Coverage: failed to get temporal extent for source {$source->source_name}: {$e->getMessage()}");

            return ['earliest' => null, 'latest' => null];
        }
    }

    /**
     * Export coverage matrix as CSV content.
     *
     * @return array{headers: string[], rows: array<int, array<int, string|int>>}
     */
    public function exportMatrix(string $format = 'csv'): array
    {
        $matrix = $this->getMatrix();
        $headers = array_merge(['Source'], $matrix['domains'], ['Domains with Data']);

        $rows = [];
        foreach ($matrix['sources'] as $idx => $source) {
            $row = [$source['name']];
            foreach ($matrix['domains'] as $domain) {
                $cell = $matrix['matrix'][$idx][$domain] ?? null;
                $row[] = $cell ? $cell['record_count'] : 0;
            }
            $row[] = $matrix['source_completeness'][$source['id']] ?? 0;
            $rows[] = $row;
        }

        // Add totals row
        $totalsRow = ['Network Total'];
        foreach ($matrix['domains'] as $domain) {
            $totalsRow[] = $matrix['domain_totals'][$domain] ?? 0;
        }
        $totalsRow[] = '--';
        $rows[] = $totalsRow;

        return ['headers' => $headers, 'rows' => $rows];
    }

    /**
     * Get record counts per domain for a source from Achilles results.
     *
     * @return array<string, int>
     */
    private function getSourceDomainCounts(Source $source): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                DB::connection('results')->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            $analysisIds = array_values(self::DOMAIN_COUNT_MAP);
            $results = AchillesResult::on($connection)
                ->whereIn('analysis_id', $analysisIds)
                ->where(function ($q) {
                    $q->whereNull('stratum_1')
                        ->orWhere('stratum_1', '');
                })
                ->get();

            $analysisToResult = $results->keyBy('analysis_id');
            $counts = [];

            foreach (self::DOMAIN_COUNT_MAP as $domain => $analysisId) {
                $row = $analysisToResult->get($analysisId);
                $counts[$domain] = (int) ($row?->count_value ?? 0);
            }

            // For person count (analysis 1), use the direct count
            $personResult = AchillesResult::on($connection)
                ->where('analysis_id', 1)
                ->first();
            $counts['person'] = (int) ($personResult?->count_value ?? 0);

            return $counts;
        } catch (\Throwable $e) {
            Log::warning("Coverage: failed to query source {$source->source_name}: {$e->getMessage()}");

            return [];
        }
    }
}
