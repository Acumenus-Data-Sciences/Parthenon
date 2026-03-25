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
     * Get age distribution pyramid data for a source, split by gender.
     *
     * @return array<int, array{group: string, male: int, female: int}>
     */
    public function getAgePyramid(Source $source): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
        }

        // Analysis 3: age at first observation by gender (stratum_1=gender_concept_id, stratum_2=age)
        $results = AchillesResult::on($connection)
            ->where('analysis_id', 3)
            ->whereNotNull('stratum_1')
            ->whereNotNull('stratum_2')
            ->get();

        $ageGroups = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90+'];
        $pyramid = [];

        foreach ($ageGroups as $group) {
            $pyramid[$group] = ['group' => $group, 'male' => 0, 'female' => 0];
        }

        foreach ($results as $result) {
            $age = (int) $result->stratum_2;
            $genderConceptId = (int) $result->stratum_1;
            $count = (int) $result->count_value;

            $groupKey = match (true) {
                $age < 10 => '0-9',
                $age < 20 => '10-19',
                $age < 30 => '20-29',
                $age < 40 => '30-39',
                $age < 50 => '40-49',
                $age < 60 => '50-59',
                $age < 70 => '60-69',
                $age < 80 => '70-79',
                $age < 90 => '80-89',
                default => '90+',
            };

            // 8507 = Male, 8532 = Female in OMOP
            if ($genderConceptId === 8507) {
                $pyramid[$groupKey]['male'] += $count;
            } elseif ($genderConceptId === 8532) {
                $pyramid[$groupKey]['female'] += $count;
            }
        }

        return array_values($pyramid);
    }

    /**
     * FDA Drug Action Plan (DAP) gap analysis.
     * Compares actual demographic proportions against target enrollment percentages.
     *
     * @param  array<string, float>  $targets  Target percentages keyed by demographic label
     * @return array<int, array{source_id: int, source_name: string, gaps: array<int, array{dimension: string, source_value: float, benchmark_value: float, gap: float, status: string}>}>
     */
    public function getDapGapAnalysis(array $targets): array
    {
        $sources = Source::whereHas('daimons')->get();
        $results = [];

        foreach ($sources as $source) {
            try {
                $demographics = $this->getSourceDemographics($source);
            } catch (\Throwable) {
                continue;
            }

            $gaps = [];
            // Combine all demographic dimensions for comparison
            $allProportions = array_merge(
                $demographics['gender'],
                $demographics['race'],
                $demographics['ethnicity'],
            );

            foreach ($targets as $dimension => $targetPct) {
                $actualPct = $allProportions[$dimension] ?? 0.0;
                $gap = round($targetPct - $actualPct, 1);
                $status = match (true) {
                    abs($gap) <= 2.0 => 'met',
                    abs($gap) <= 10.0 => 'gap',
                    default => 'critical',
                };

                $gaps[] = [
                    'dimension' => $dimension,
                    'source_value' => $actualPct,
                    'benchmark_value' => $targetPct,
                    'gap' => $gap,
                    'status' => $status,
                ];
            }

            $results[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'gaps' => $gaps,
            ];
        }

        return $results;
    }

    /**
     * Pool demographics across multiple sources (weighted merge).
     *
     * @param  array<int>  $sourceIds
     * @return array{gender: array<string, float>, race: array<string, float>, ethnicity: array<string, float>, total_persons: int}
     */
    public function getPooledDemographics(array $sourceIds): array
    {
        $sources = Source::whereIn('id', $sourceIds)->whereHas('daimons')->get();

        $totalPersons = 0;
        $genderCounts = [];
        $raceCounts = [];
        $ethnicityCounts = [];

        foreach ($sources as $source) {
            try {
                $demo = $this->getSourceDemographics($source);
            } catch (\Throwable) {
                continue;
            }

            $personCount = $demo['person_count'];
            $totalPersons += $personCount;

            // Accumulate raw counts from percentages
            foreach ($demo['gender'] as $label => $pct) {
                $genderCounts[$label] = ($genderCounts[$label] ?? 0) + (int) round($pct / 100 * $personCount);
            }
            foreach ($demo['race'] as $label => $pct) {
                $raceCounts[$label] = ($raceCounts[$label] ?? 0) + (int) round($pct / 100 * $personCount);
            }
            foreach ($demo['ethnicity'] as $label => $pct) {
                $ethnicityCounts[$label] = ($ethnicityCounts[$label] ?? 0) + (int) round($pct / 100 * $personCount);
            }
        }

        // Convert back to percentages
        $toPercentages = function (array $counts) use ($totalPersons): array {
            if ($totalPersons === 0) {
                return [];
            }
            $result = [];
            foreach ($counts as $label => $count) {
                $result[$label] = round(($count / $totalPersons) * 100, 1);
            }
            arsort($result);

            return $result;
        };

        return [
            'gender' => $toPercentages($genderCounts),
            'race' => $toPercentages($raceCounts),
            'ethnicity' => $toPercentages($ethnicityCounts),
            'total_persons' => $totalPersons,
        ];
    }

    /**
     * Get geographic diversity data for a single source.
     *
     * Queries person->location for state/zip distribution.
     * Optionally joins gis.adi_data for Area Deprivation Index if available.
     *
     * @return array{state_distribution: array<string, int>, adi_distribution: array<string, int>, geographic_reach: int, median_adi: float|null}
     */
    public function getGeographicDiversity(Source $source): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::CDM->value)->first();
        $schema = $daimon?->table_qualifier ?? 'omop';

        $connection = 'omop';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('omop')->statement(
                "SET search_path TO \"{$schema}\", public"
            );
        }

        // Query person -> location for state distribution
        $stateDistribution = [];
        $zipCodes = [];

        try {
            $rows = DB::connection($connection)
                ->table('person')
                ->join('location', 'person.location_id', '=', 'location.location_id')
                ->select(DB::raw('location.state AS state, COUNT(*) AS cnt'))
                ->whereNotNull('location.state')
                ->groupBy('location.state')
                ->orderByDesc('cnt')
                ->get();

            foreach ($rows as $row) {
                $stateDistribution[$row->state] = (int) $row->cnt;
            }

            // Get zip codes for ADI lookup
            $zipRows = DB::connection($connection)
                ->table('person')
                ->join('location', 'person.location_id', '=', 'location.location_id')
                ->select('location.zip')
                ->whereNotNull('location.zip')
                ->distinct()
                ->limit(10000)
                ->get();

            $zipCodes = $zipRows->pluck('zip')->toArray();
        } catch (\Throwable $e) {
            Log::warning("GeoDiversity: failed to query locations for source {$source->source_name}: {$e->getMessage()}");
        }

        // ADI distribution — attempt gis.adi_data join (graceful degradation if unavailable)
        $adiDistribution = [];
        $medianAdi = null;

        if (! empty($zipCodes)) {
            try {
                $adiRows = DB::connection('gis')
                    ->table('adi_data')
                    ->select(DB::raw('adi_natrank_median AS decile, COUNT(*) AS cnt'))
                    ->whereIn('zipcode', array_map(fn ($z) => substr((string) $z, 0, 5), $zipCodes))
                    ->whereNotNull('adi_natrank_median')
                    ->groupBy('adi_natrank_median')
                    ->orderBy('adi_natrank_median')
                    ->get();

                foreach ($adiRows as $row) {
                    $decile = (string) $row->decile;
                    $adiDistribution[$decile] = (int) $row->cnt;
                }

                // Compute median ADI from all zip matches
                $allAdi = DB::connection('gis')
                    ->table('adi_data')
                    ->whereIn('zipcode', array_map(fn ($z) => substr((string) $z, 0, 5), $zipCodes))
                    ->whereNotNull('adi_natrank_median')
                    ->pluck('adi_natrank_median')
                    ->sort()
                    ->values();

                if ($allAdi->isNotEmpty()) {
                    $mid = (int) floor($allAdi->count() / 2);
                    $medianAdi = $allAdi->count() % 2 === 0
                        ? round(((float) $allAdi[$mid - 1] + (float) $allAdi[$mid]) / 2, 1)
                        : round((float) $allAdi[$mid], 1);
                }
            } catch (\Throwable $e) {
                Log::info("GeoDiversity: ADI data not available for source {$source->source_name}: {$e->getMessage()}");
                // Graceful degradation — ADI data not loaded
            }
        }

        return [
            'state_distribution' => $stateDistribution,
            'adi_distribution' => $adiDistribution,
            'geographic_reach' => count($stateDistribution),
            'median_adi' => $medianAdi,
        ];
    }

    /**
     * Get geographic diversity aggregated across all sources.
     *
     * @return array<int, array{source_id: int, source_name: string, state_distribution: array<string, int>, adi_distribution: array<string, int>, geographic_reach: int, median_adi: float|null}>
     */
    public function getNetworkGeographicDiversity(): array
    {
        return Cache::remember('ares:network:geographic-diversity', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                try {
                    $geo = $this->getGeographicDiversity($source);
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        ...$geo,
                    ];
                } catch (\Throwable $e) {
                    Log::warning("GeoDiversity: failed for source {$source->source_name}: {$e->getMessage()}");
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'state_distribution' => [],
                        'adi_distribution' => [],
                        'geographic_reach' => 0,
                        'median_adi' => null,
                    ];
                }
            }

            return $results;
        });
    }

    /**
     * Get diversity trends over releases for a source.
     * Computes Simpson's Diversity Index per release from demographic Achilles results.
     *
     * @return array{releases: array<int, array{release_name: string, created_at: string, gender_index: float, race_index: float, ethnicity_index: float, composite_index: float}>}
     */
    public function getDiversityTrends(Source $source): array
    {
        $releases = \App\Models\App\SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        if ($releases->isEmpty()) {
            return ['releases' => []];
        }

        $results = [];

        foreach ($releases as $release) {
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

                // Get person count
                $personResult = AchillesResult::on($connection)
                    ->where('analysis_id', 1)
                    ->first();
                $personCount = (int) ($personResult?->count_value ?? 0);

                if ($personCount === 0) {
                    $results[] = [
                        'release_name' => $release->release_name,
                        'created_at' => $release->created_at->toISOString(),
                        'gender_index' => 0.0,
                        'race_index' => 0.0,
                        'ethnicity_index' => 0.0,
                        'composite_index' => 0.0,
                    ];

                    continue;
                }

                $gender = $this->getProportions($connection, self::GENDER_ANALYSIS, $personCount);
                $race = $this->getProportions($connection, self::RACE_ANALYSIS, $personCount);
                $ethnicity = $this->getProportions($connection, self::ETHNICITY_ANALYSIS, $personCount);

                $genderIndex = $this->computeDimensionIndex($gender);
                $raceIndex = $this->computeDimensionIndex($race);
                $ethnicityIndex = $this->computeDimensionIndex($ethnicity);

                $indices = array_filter([$genderIndex, $raceIndex, $ethnicityIndex], fn ($v) => $v > 0);
                $composite = ! empty($indices) ? round(array_sum($indices) / count($indices), 3) : 0.0;

                $results[] = [
                    'release_name' => $release->release_name,
                    'created_at' => $release->created_at->toISOString(),
                    'gender_index' => $genderIndex,
                    'race_index' => $raceIndex,
                    'ethnicity_index' => $ethnicityIndex,
                    'composite_index' => $composite,
                ];
            } catch (\Throwable $e) {
                Log::warning("DiversityService: getDiversityTrends failed for release {$release->release_name}: {$e->getMessage()}");
                $results[] = [
                    'release_name' => $release->release_name,
                    'created_at' => $release->created_at->toISOString(),
                    'gender_index' => 0.0,
                    'race_index' => 0.0,
                    'ethnicity_index' => 0.0,
                    'composite_index' => 0.0,
                ];
            }
        }

        return ['releases' => $results];
    }

    /**
     * Compute Simpson's Diversity Index for a single demographic dimension.
     *
     * @param  array<string, float>  $proportions  Percentages (0-100)
     */
    private function computeDimensionIndex(array $proportions): float
    {
        if (empty($proportions)) {
            return 0.0;
        }

        $sumPSquared = 0.0;
        foreach ($proportions as $pct) {
            $p = $pct / 100.0;
            $sumPSquared += $p * $p;
        }

        return round(1.0 - $sumPSquared, 3);
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
