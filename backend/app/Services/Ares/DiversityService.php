<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DiversityService
{
    /**
     * Achilles analysis IDs for demographics.
     * Analysis 2 = gender, Analysis 4 = race, Analysis 5 = ethnicity
     */
    private const GENDER_ANALYSIS = 2;

    private const RACE_ANALYSIS = 4;

    private const ETHNICITY_ANALYSIS = 5;

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Get demographic proportions per source.
     *
     * @return array<int, array{source_id: int, source_name: string, person_count: int, gender: array<string, float>, race: array<string, float>, ethnicity: array<string, float>}>
     */
    public function getDiversity(): array
    {
        return Cache::remember('ares:network:diversity', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                try {
                    $results[] = $this->getSourceDemographics($source);
                } catch (\Throwable $e) {
                    Log::warning("Diversity: failed to query source {$source->source_name}: {$e->getMessage()}");
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'person_count' => 0,
                        'gender' => [],
                        'race' => [],
                        'ethnicity' => [],
                        'simpson_index' => 0.0,
                        'diversity_rating' => 'low',
                    ];
                }
            }

            // Compute Simpson's diversity index for each source
            foreach ($results as &$row) {
                $index = $this->computeSimpsonIndex($row);
                $row['simpson_index'] = $index;
                $row['diversity_rating'] = $this->rateDiversity($index);
            }
            unset($row);

            // Sort by person count descending
            usort($results, fn ($a, $b) => $b['person_count'] <=> $a['person_count']);

            return $results;
        });
    }

    /**
     * Get demographic breakdown for a single source.
     *
     * @return array{source_id: int, source_name: string, person_count: int, gender: array<string, float>, race: array<string, float>, ethnicity: array<string, float>}
     */
    private function getSourceDemographics(Source $source): array
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

        // Get person count
        $personResult = AchillesResult::on($connection)
            ->where('analysis_id', 1)
            ->first();
        $personCount = (int) ($personResult?->count_value ?? 0);

        // Get gender distribution (analysis 2)
        $gender = $this->getProportions($connection, self::GENDER_ANALYSIS, $personCount);

        // Get race distribution (analysis 4)
        $race = $this->getProportions($connection, self::RACE_ANALYSIS, $personCount);

        // Get ethnicity distribution (analysis 5)
        $ethnicity = $this->getProportions($connection, self::ETHNICITY_ANALYSIS, $personCount);

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'person_count' => $personCount,
            'gender' => $gender,
            'race' => $race,
            'ethnicity' => $ethnicity,
        ];
    }

    /**
     * Convert Achilles results for a demographic analysis into proportional percentages.
     *
     * @return array<string, float>
     */
    private function getProportions(string $connection, int $analysisId, int $personCount): array
    {
        if ($personCount === 0) {
            return [];
        }

        $results = AchillesResult::on($connection)
            ->where('analysis_id', $analysisId)
            ->whereNotNull('stratum_1')
            ->get();

        $proportions = [];
        foreach ($results as $result) {
            $label = $this->resolveConceptName($result->stratum_1) ?? "Concept {$result->stratum_1}";
            $count = (int) $result->count_value;
            $proportions[$label] = round(($count / $personCount) * 100, 1);
        }

        // Sort by proportion descending
        arsort($proportions);

        return $proportions;
    }

    /**
     * Compute Simpson's Diversity Index averaged across race, ethnicity, and gender.
     *
     * Simpson's = 1 - sum(p_i^2) where p_i is the proportion of each category.
     * The index is averaged across all non-empty demographic dimensions.
     *
     * @param  array{gender: array<string, float>, race: array<string, float>, ethnicity: array<string, float>}  $sourceData
     */
    private function computeSimpsonIndex(array $sourceData): float
    {
        $dimensions = ['race', 'ethnicity', 'gender'];
        $indices = [];

        foreach ($dimensions as $dim) {
            $proportions = $sourceData[$dim] ?? [];
            if (empty($proportions)) {
                continue;
            }

            // Proportions are stored as percentages (0-100); convert to 0-1 fractions
            $sumPSquared = 0.0;
            foreach ($proportions as $pct) {
                $p = $pct / 100.0;
                $sumPSquared += $p * $p;
            }

            $indices[] = 1.0 - $sumPSquared;
        }

        if (empty($indices)) {
            return 0.0;
        }

        return round(array_sum($indices) / count($indices), 3);
    }

    /**
     * Map a Simpson's index value to a human-readable rating.
     */
    private function rateDiversity(float $index): string
    {
        return match (true) {
            $index >= 0.8 => 'very_high',
            $index >= 0.6 => 'high',
            $index >= 0.4 => 'moderate',
            default => 'low',
        };
    }

    /**
     * Resolve a concept_id to a concept_name from the vocabulary.
     */
    private function resolveConceptName(string $conceptId): ?string
    {
        /** @var array<string, string|null> */
        static $cache = [];

        if (isset($cache[$conceptId])) {
            return $cache[$conceptId];
        }

        try {
            $concept = DB::connection('omop')
                ->table('concept')
                ->where('concept_id', (int) $conceptId)
                ->value('concept_name');

            $cache[$conceptId] = $concept;

            return $concept;
        } catch (\Throwable) {
            return null;
        }
    }
}
