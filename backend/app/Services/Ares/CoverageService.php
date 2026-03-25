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
