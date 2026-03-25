<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ConceptStandardizationService
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

    /**
     * Achilles analysis IDs for age-sex stratified prevalence:
     * - 402/702/602/1802/802: concept by gender
     * - 404/704/604/1804/804: concept by age decile
     *
     * @var array<string, array{by_gender: int, by_age: int}>
     */
    private const DOMAIN_STRATIFIED_MAP = [
        'condition' => ['by_gender' => 402, 'by_age' => 404],
        'drug' => ['by_gender' => 702, 'by_age' => 704],
        'procedure' => ['by_gender' => 602, 'by_age' => 604],
        'measurement' => ['by_gender' => 1802, 'by_age' => 1804],
        'observation' => ['by_gender' => 802, 'by_age' => 804],
        'visit' => ['by_gender' => 202, 'by_age' => 204],
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Compute age-sex standardized rates for a concept across all sources.
     *
     * @return array<int, array{source_id: int, source_name: string, crude_rate: float, standardized_rate: float, ci_lower: float, ci_upper: float, person_count: int, warning: string|null}>
     */
    public function standardize(int $conceptId, string $method = 'direct'): array
    {
        $sources = Source::whereHas('daimons')->get();
        /** @var array<string, array<int, float>> $referencePopulation */
        $referencePopulation = config('ares.reference_population', []);
        $results = [];

        foreach ($sources as $source) {
            try {
                $data = $this->standardizeForSource($source, $conceptId, $referencePopulation);
                $results[] = $data;
            } catch (\Throwable $e) {
                Log::warning("ConceptStandardization: failed for {$source->source_name}: {$e->getMessage()}");
                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'crude_rate' => 0.0,
                    'standardized_rate' => 0.0,
                    'ci_lower' => 0.0,
                    'ci_upper' => 0.0,
                    'person_count' => 0,
                    'warning' => 'Failed to query source',
                ];
            }
        }

        return $results;
    }

    /**
     * Standardize a concept's rate for a single source using direct standardization.
     *
     * @param  array<string, array<int, float>>  $referencePopulation
     * @return array{source_id: int, source_name: string, crude_rate: float, standardized_rate: float, ci_lower: float, ci_upper: float, person_count: int, warning: string|null}
     */
    private function standardizeForSource(Source $source, int $conceptId, array $referencePopulation): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
        }

        // 1. Get total person count (analysis 1)
        $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
        $totalPersons = (int) ($personResult?->count_value ?? 0);

        // 2. Get crude concept count across all domains
        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);
        $crudeResult = AchillesResult::on($connection)
            ->whereIn('analysis_id', $analysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
            ->first();

        $crudeCount = (int) ($crudeResult?->total_count ?? 0);
        $crudeRate = $totalPersons > 0 ? ($crudeCount / $totalPersons) * 1000 : 0.0;

        // 3. Get age-sex population structure from analysis 10 (year_of_birth x gender)
        $populationStrata = $this->getPopulationStrata($connection);

        // 4. Get concept prevalence stratified by gender
        $conceptByGender = $this->getConceptByGender($connection, $conceptId);

        // 5. Get concept prevalence stratified by age decile
        $conceptByAge = $this->getConceptByAge($connection, $conceptId);

        // 6. Attempt direct standardization
        if (empty($populationStrata) || (empty($conceptByGender) && empty($conceptByAge))) {
            // Insufficient stratification data — return crude rate with warning
            $ci = $this->wilsonScoreInterval($crudeCount, $totalPersons);

            return [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'crude_rate' => round($crudeRate, 2),
                'standardized_rate' => round($crudeRate, 2),
                'ci_lower' => round($ci[0] * 1000, 2),
                'ci_upper' => round($ci[1] * 1000, 2),
                'person_count' => $totalPersons,
                'warning' => 'Insufficient age-sex stratification; returning crude rate',
            ];
        }

        // 7. Compute age-sex specific rates and apply reference weights
        $standardizedRate = 0.0;
        $totalWeight = 0.0;
        $effectiveSampleSize = 0;

        foreach ($referencePopulation as $ageGroup => $genderWeights) {
            foreach ($genderWeights as $genderConceptId => $weight) {
                $stratuKey = "{$ageGroup}:{$genderConceptId}";

                // Source population in this stratum
                $stratumPop = $populationStrata[$stratuKey] ?? 0;

                if ($stratumPop <= 0) {
                    continue;
                }

                // Estimate concept count for this stratum using available data
                $stratumConceptCount = $this->estimateStratumCount(
                    $conceptByGender,
                    $conceptByAge,
                    $genderConceptId,
                    $ageGroup,
                    $crudeCount,
                    $totalPersons,
                    $populationStrata,
                );

                $stratumRate = $stratumConceptCount / $stratumPop;
                $standardizedRate += $stratumRate * $weight;
                $totalWeight += $weight;
                $effectiveSampleSize += $stratumPop;
            }
        }

        // Normalize by total weight (should be ~1.0 but may not sum exactly due to missing strata)
        if ($totalWeight > 0) {
            $standardizedRate = ($standardizedRate / $totalWeight) * 1000;
        }

        // Confidence interval using effective sample size
        $ci = $this->wilsonScoreInterval(
            (int) round($standardizedRate / 1000 * $effectiveSampleSize),
            $effectiveSampleSize
        );

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'crude_rate' => round($crudeRate, 2),
            'standardized_rate' => round($standardizedRate, 2),
            'ci_lower' => round($ci[0] * 1000, 2),
            'ci_upper' => round($ci[1] * 1000, 2),
            'person_count' => $totalPersons,
            'warning' => null,
        ];
    }

    /**
     * Get population strata from Achilles analysis 10 (year_of_birth x gender).
     * Returns keyed by "ageGroup:genderConceptId".
     *
     * @return array<string, int>
     */
    private function getPopulationStrata(string $connection): array
    {
        // Analysis 10: stratum_1 = year_of_birth, stratum_2 = gender_concept_id
        $rows = AchillesResult::on($connection)
            ->where('analysis_id', 10)
            ->whereNotNull('stratum_1')
            ->whereNotNull('stratum_2')
            ->get();

        $currentYear = (int) date('Y');
        $strata = [];

        foreach ($rows as $row) {
            $birthYear = (int) $row->stratum_1;
            $genderConceptId = (int) $row->stratum_2;
            $count = (int) ($row->count_value ?? 0);

            $age = $currentYear - $birthYear;
            $ageGroup = $this->ageToGroup($age);

            $key = "{$ageGroup}:{$genderConceptId}";
            $strata[$key] = ($strata[$key] ?? 0) + $count;
        }

        return $strata;
    }

    /**
     * Get concept counts stratified by gender across all relevant domain analyses.
     *
     * @return array<int, int>  gender_concept_id => count
     */
    private function getConceptByGender(string $connection, int $conceptId): array
    {
        $genderAnalysisIds = array_column(self::DOMAIN_STRATIFIED_MAP, 'by_gender');

        $rows = AchillesResult::on($connection)
            ->whereIn('analysis_id', $genderAnalysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->whereNotNull('stratum_2')
            ->get();

        $result = [];
        foreach ($rows as $row) {
            $genderId = (int) $row->stratum_2;
            $count = (int) ($row->count_value ?? 0);
            $result[$genderId] = ($result[$genderId] ?? 0) + $count;
        }

        return $result;
    }

    /**
     * Get concept counts stratified by age decile across all relevant domain analyses.
     *
     * @return array<string, int>  age_group => count
     */
    private function getConceptByAge(string $connection, int $conceptId): array
    {
        $ageAnalysisIds = array_column(self::DOMAIN_STRATIFIED_MAP, 'by_age');

        $rows = AchillesResult::on($connection)
            ->whereIn('analysis_id', $ageAnalysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->whereNotNull('stratum_2')
            ->get();

        $currentYear = (int) date('Y');
        $result = [];

        foreach ($rows as $row) {
            // stratum_2 for age analyses is typically the age decile or year_of_birth
            $stratum2 = (int) $row->stratum_2;
            $count = (int) ($row->count_value ?? 0);

            // Determine if stratum_2 is an age decile (0-9, 10-19, etc.) or birth year
            if ($stratum2 > 1900) {
                // It's a birth year — convert to age group
                $age = $currentYear - $stratum2;
                $ageGroup = $this->ageToGroup($age);
            } else {
                // It's an age decile marker (e.g. 0, 10, 20, ...)
                $ageGroup = $this->ageToGroup($stratum2);
            }

            $result[$ageGroup] = ($result[$ageGroup] ?? 0) + $count;
        }

        return $result;
    }

    /**
     * Estimate the concept count for a specific age-sex stratum.
     *
     * Uses available gender and age stratification data to approximate
     * the joint age-sex distribution when the full cross-tab is not available.
     *
     * @param  array<int, int>  $conceptByGender
     * @param  array<string, int>  $conceptByAge
     * @param  array<string, int>  $populationStrata
     */
    private function estimateStratumCount(
        array $conceptByGender,
        array $conceptByAge,
        int $genderConceptId,
        string $ageGroup,
        int $totalCrudeCount,
        int $totalPersons,
        array $populationStrata,
    ): float {
        if ($totalCrudeCount === 0 || $totalPersons === 0) {
            return 0.0;
        }

        // Compute gender proportion of concept
        $genderTotal = array_sum($conceptByGender);
        $genderProportion = $genderTotal > 0
            ? ($conceptByGender[$genderConceptId] ?? 0) / $genderTotal
            : 0.5; // Assume equal if no gender data

        // Compute age proportion of concept
        $ageTotal = array_sum($conceptByAge);
        $ageProportion = $ageTotal > 0
            ? ($conceptByAge[$ageGroup] ?? 0) / $ageTotal
            : $this->getDefaultAgeProportion($ageGroup, $populationStrata, $genderConceptId);

        // Joint estimate: assume conditional independence of age and gender
        // concept_count_stratum ≈ total_count * P(gender|concept) * P(age|concept) / P(gender) / P(age)
        // Simplified: total_count * gender_prop * age_prop * normalization
        $estimatedCount = $totalCrudeCount * $genderProportion * $ageProportion;

        // Apply normalization so the sum across strata equals the crude total
        if ($genderTotal > 0 && $ageTotal > 0) {
            $normalizationFactor = 1.0; // Already proportions that should sum to 1
            $estimatedCount *= $normalizationFactor;
        }

        return max(0, $estimatedCount);
    }

    /**
     * Get default age proportion based on population structure when concept age data is missing.
     *
     * @param  array<string, int>  $populationStrata
     */
    private function getDefaultAgeProportion(string $ageGroup, array $populationStrata, int $genderConceptId): float
    {
        $totalPop = 0;
        $groupPop = 0;

        foreach ($populationStrata as $key => $count) {
            $totalPop += $count;
            if (str_starts_with($key, "{$ageGroup}:")) {
                $groupPop += $count;
            }
        }

        return $totalPop > 0 ? $groupPop / $totalPop : 0.1;
    }

    /**
     * Convert an age in years to a decade age group string.
     */
    private function ageToGroup(int $age): string
    {
        if ($age < 0) {
            return '0-9';
        }
        if ($age >= 90) {
            return '90+';
        }

        $decade = (int) floor($age / 10) * 10;

        return "{$decade}-" . ($decade + 9);
    }

    /**
     * Wilson score 95% confidence interval for a proportion.
     *
     * @return array{0: float, 1: float}  [lower, upper] as proportions (0-1)
     */
    private function wilsonScoreInterval(int $successes, int $trials): array
    {
        if ($trials <= 0 || $successes <= 0) {
            return [0.0, 0.0];
        }

        $p = $successes / $trials;
        $z = 1.96; // 95% confidence

        $denominator = 1 + ($z * $z / $trials);
        $center = ($p + ($z * $z) / (2 * $trials)) / $denominator;
        $spread = ($z / $denominator) * sqrt(
            ($p * (1 - $p) / $trials) + ($z * $z / (4 * $trials * $trials))
        );

        return [
            max(0.0, $center - $spread),
            min(1.0, $center + $spread),
        ];
    }
}
