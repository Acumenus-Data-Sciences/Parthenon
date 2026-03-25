<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NetworkComparisonService
{
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
     * @return array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int}>
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
                ];
            }
        }

        return $results;
    }

    /**
     * Compare multiple concepts across all sources.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int}>>
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

        $results = DB::connection('omop')
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
     * Get concept prevalence data for a specific source.
     *
     * @return array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int}
     */
    private function getConceptDataForSource(Source $source, int $conceptId): array
    {
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

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'count' => $count,
            'rate_per_1000' => $ratePer1000,
            'person_count' => $personCount,
        ];
    }
}
