<?php

namespace App\Services\Achilles;

use App\Models\App\Source;
use App\Models\Results\AchillesAnalysis;
use App\Models\Results\AchillesPerformance;
use App\Models\Results\AchillesResult;
use App\Models\Results\AchillesResultDist;
use Illuminate\Support\Facades\DB;

class AchillesResultReaderService
{
    /**
     * Mapping of domain names to their base Achilles analysis IDs.
     *
     * Each domain maps to:
     *   - count: total concept count analysis
     *   - type: type distribution analysis
     *   - prevalence: prevalence analysis (if applicable)
     *   - gender: by gender analysis
     *   - age_dist: age at occurrence distribution analysis
     *   - age: age at occurrence analysis
     *   - month: concept by month analysis
     *
     * @var array<string, array<string, int>>
     */
    private const DOMAIN_ANALYSIS_MAP = [
        'condition' => [
            'count' => 400,
            'type' => 401,
            'gender' => 402,
            'prevalence' => 403,
            'age_dist' => 404,
            'age' => 405,
            'month' => 411,
        ],
        'drug' => [
            'count' => 700,
            'type' => 701,
            'gender' => 702,
            'prevalence' => 703,
            'age_dist' => 704,
            'age' => 705,
            'month' => 711,
        ],
        'procedure' => [
            'count' => 600,
            'type' => 601,
            'gender' => 602,
            'prevalence' => 603,
            'age_dist' => 604,
            'age' => 605,
            'month' => 611,
        ],
        'measurement' => [
            'count' => 1800,
            'type' => 1801,
            'gender' => 1802,
            'prevalence' => 1803,
            'age_dist' => 1804,
            'age' => 1805,
            'month' => 1811,
        ],
        'observation' => [
            'count' => 800,
            'type' => 801,
            'gender' => 802,
            'prevalence' => 803,
            'age_dist' => 804,
            'age' => 805,
            'month' => 811,
        ],
        'visit' => [
            'count' => 200,
            'type' => 201,
            'gender' => 202,
            'age_dist' => 204,
            'age' => 203,
            'month' => 211,
        ],
    ];

    /**
     * Well-known OHDSI gender concept IDs mapped to readable names.
     *
     * @var array<int, string>
     */
    private const GENDER_CONCEPTS = [
        8507 => 'Male',
        8532 => 'Female',
        8551 => 'Unknown',
        8570 => 'Ambiguous',
    ];

    /**
     * Analysis IDs that produce domain-level record counts.
     * Keyed by CDM table name => analysis_id.
     *
     * @var array<string, int>
     */
    private const RECORD_COUNT_ANALYSES = [
        'person' => 0,
        'observation_period' => 101,
        'visit_occurrence' => 200,
        'visit_detail' => 200, // uses same base, distinct via stratum
        'condition_occurrence' => 400,
        'drug_exposure' => 700,
        'procedure_occurrence' => 600,
        'device_exposure' => 2100,
        'measurement' => 1800,
        'observation' => 800,
        'death' => 500,
        'note' => 2200,
        'specimen' => 2300,
        'drug_era' => 900,
        'condition_era' => 1000,
        'payer_plan_period' => 1600,
        'cost' => 1700,
    ];

    /**
     * Allowed domain names for validation.
     *
     * @var array<string>
     */
    public const ALLOWED_DOMAINS = [
        'condition',
        'drug',
        'procedure',
        'measurement',
        'observation',
        'visit',
    ];

    /**
     * Get record counts for all CDM tables.
     *
     * Analysis 0 = total person count; other analyses store counts in count_value.
     * We look up specific analysis IDs that give total counts per domain.
     *
     * @return array<int, array{table: string, count: int}>
     */
    public function getRecordCounts(Source $source): array
    {
        $analysisIds = array_values(self::RECORD_COUNT_ANALYSES);

        $results = AchillesResult::forAnalysis($analysisIds)
            ->get()
            ->groupBy('analysis_id');

        $counts = [];

        foreach (self::RECORD_COUNT_ANALYSES as $table => $analysisId) {
            $rows = $results->get($analysisId);

            if ($rows === null || $rows->isEmpty()) {
                $counts[] = ['table' => $table, 'count' => 0];

                continue;
            }

            // Analysis 0 is a special case: single row with total person count
            if ($analysisId === 0) {
                $counts[] = [
                    'table' => $table,
                    'count' => (int) $rows->first()->count_value,
                ];

                continue;
            }

            // For domain analyses, sum all count_values to get total record count
            $counts[] = [
                'table' => $table,
                'count' => (int) $rows->sum('count_value'),
            ];
        }

        return $counts;
    }

    /**
     * Get demographic distributions.
     *
     * @return array{
     *     gender: array<int, array{concept_id: int, concept_name: string, count: int}>,
     *     race: array<int, array{concept_id: int, concept_name: string, count: int}>,
     *     ethnicity: array<int, array{concept_id: int, concept_name: string, count: int}>,
     *     age: array<int, array{age_decile: string, count: int}>,
     *     yearOfBirth: array<int, array{year: string, count: int}>
     * }
     */
    public function getDemographics(Source $source): array
    {
        // Analysis 2: gender distribution (stratum_1 = gender_concept_id)
        $genderRows = AchillesResult::forAnalysis(2)->get();
        $gender = $genderRows->map(fn ($row) => [
            'concept_id' => (int) $row->stratum_1,
            'concept_name' => $this->resolveConceptName((int) $row->stratum_1),
            'count' => (int) $row->count_value,
        ])->values()->toArray();

        // Analysis 4: year of birth distribution (stratum_1 = year_of_birth)
        $yearOfBirthRows = AchillesResult::forAnalysis(4)->get();
        $yearOfBirth = $yearOfBirthRows->map(fn ($row) => [
            'year' => $row->stratum_1,
            'count' => (int) $row->count_value,
        ])->sortBy('year')->values()->toArray();

        // Analysis 5: ethnicity distribution (stratum_1 = ethnicity_concept_id)
        $ethnicityRows = AchillesResult::forAnalysis(5)->get();
        $ethnicity = $ethnicityRows->map(fn ($row) => [
            'concept_id' => (int) $row->stratum_1,
            'concept_name' => $this->resolveConceptName((int) $row->stratum_1),
            'count' => (int) $row->count_value,
        ])->values()->toArray();

        // Analysis 3: age at first observation (stratum_1 = age decile)
        $ageRows = AchillesResult::forAnalysis(3)->get();
        $age = $ageRows->map(fn ($row) => [
            'age_decile' => $row->stratum_1,
            'count' => (int) $row->count_value,
        ])->sortBy('age_decile')->values()->toArray();

        // Race: analysis 10 gives race by gender (stratum_1 = race_concept_id, stratum_2 = gender_concept_id)
        // We aggregate across genders to get race totals
        $raceRows = AchillesResult::forAnalysis(10)->get();
        $raceAggregated = $raceRows->groupBy('stratum_1')->map(function ($group) {
            $conceptId = (int) $group->first()->stratum_1;

            return [
                'concept_id' => $conceptId,
                'concept_name' => $this->resolveConceptName($conceptId),
                'count' => (int) $group->sum('count_value'),
            ];
        })->values()->toArray();

        return [
            'gender' => $gender,
            'race' => $raceAggregated,
            'ethnicity' => $ethnicity,
            'age' => $age,
            'yearOfBirth' => $yearOfBirth,
        ];
    }

    /**
     * Get observation period statistics.
     *
     * @return array{
     *     count: int,
     *     durationDistribution: array{min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float}|null,
     *     startYearMonth: array<int, array{year_month: string, count: int}>,
     *     endYearMonth: array<int, array{year_month: string, count: int}>,
     *     periodsByPerson: array<int, array{count_value: string, persons: int}>,
     *     ageDist: array{min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float}|null
     * }
     */
    public function getObservationPeriods(Source $source): array
    {
        // Analysis 101: observation period count
        $countRow = AchillesResult::forAnalysis(101)->first();
        $count = $countRow ? (int) $countRow->count_value : 0;

        // Analysis 109: observation period length distribution
        $durationDist = $this->extractDistribution(109);

        // Analysis 111: observation period start year+month (stratum_1 = YYYYMM)
        $startYearMonthRows = AchillesResult::forAnalysis(111)->get();
        $startYearMonth = $startYearMonthRows->map(fn ($row) => [
            'year_month' => $row->stratum_1,
            'count' => (int) $row->count_value,
        ])->sortBy('year_month')->values()->toArray();

        // Analysis 106: observation period end month
        $endYearMonthRows = AchillesResult::forAnalysis(106)->get();
        $endYearMonth = $endYearMonthRows->map(fn ($row) => [
            'year_month' => $row->stratum_1,
            'count' => (int) $row->count_value,
        ])->sortBy('year_month')->values()->toArray();

        // Analysis 108: persons by observation period count (stratum_1 = number of periods)
        $periodsByPersonRows = AchillesResult::forAnalysis(108)->get();
        $periodsByPerson = $periodsByPersonRows->map(fn ($row) => [
            'count_value' => $row->stratum_1,
            'persons' => (int) $row->count_value,
        ])->sortBy('count_value')->values()->toArray();

        // Analysis 113: age at observation period start distribution
        $ageDist = $this->extractDistribution(113);

        return [
            'count' => $count,
            'durationDistribution' => $durationDist,
            'startYearMonth' => $startYearMonth,
            'endYearMonth' => $endYearMonth,
            'periodsByPerson' => $periodsByPerson,
            'ageDist' => $ageDist,
        ];
    }

    /**
     * Get domain summary (top concepts by prevalence).
     *
     * @param  string  $domain  One of: condition, drug, procedure, measurement, observation, visit
     * @param  int  $limit  Number of top concepts to return
     * @return array{totalRecords: int, totalConcepts: int, topConcepts: array<int, array{concept_id: int, concept_name: string, count: int, prevalence: float}>}
     */
    public function getDomainSummary(Source $source, string $domain, int $limit = 25): array
    {
        $analysisMap = self::DOMAIN_ANALYSIS_MAP[$domain] ?? null;

        if ($analysisMap === null) {
            return ['totalRecords' => 0, 'totalConcepts' => 0, 'topConcepts' => []];
        }

        $countAnalysisId = $analysisMap['count'];

        // Get all concept rows for this domain's count analysis
        // stratum_1 = concept_id, count_value = number of records
        $conceptRows = AchillesResult::forAnalysis($countAnalysisId)
            ->orderByDesc('count_value')
            ->get();

        $totalRecords = (int) $conceptRows->sum('count_value');
        $totalConcepts = $conceptRows->count();

        // Get the total person count for prevalence calculation
        $personCount = $this->getTotalPersonCount();

        // Top concepts by count
        $topRows = $conceptRows->take($limit);

        // Batch resolve concept names
        $conceptIds = $topRows->pluck('stratum_1')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->toArray();
        $conceptNames = $this->batchResolveConceptNames($conceptIds);

        $topConcepts = $topRows->map(function ($row) use ($conceptNames, $personCount) {
            $conceptId = (int) $row->stratum_1;
            $count = (int) $row->count_value;
            $prevalence = $personCount > 0 ? round($count / $personCount, 6) : 0.0;

            return [
                'concept_id' => $conceptId,
                'concept_name' => $conceptNames[$conceptId] ?? "Concept {$conceptId}",
                'count' => $count,
                'prevalence' => $prevalence,
            ];
        })->values()->toArray();

        return [
            'totalRecords' => $totalRecords,
            'totalConcepts' => $totalConcepts,
            'topConcepts' => $topConcepts,
        ];
    }

    /**
     * Get concept drilldown detail for a specific concept_id within a domain.
     * Returns age distribution, gender split, temporal trend, type distribution.
     *
     * @return array{
     *     conceptId: int,
     *     conceptName: string,
     *     recordCount: int,
     *     genderDistribution: array<int, array{concept_id: int, concept_name: string, count: int}>,
     *     ageDistribution: array{min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float}|null,
     *     monthlyTrend: array<int, array{year_month: string, count: int}>,
     *     typeDistribution: array<int, array{concept_id: int, concept_name: string, count: int}>
     * }
     */
    public function getConceptDrilldown(Source $source, string $domain, int $conceptId): array
    {
        $analysisMap = self::DOMAIN_ANALYSIS_MAP[$domain] ?? null;

        if ($analysisMap === null) {
            return [
                'conceptId' => $conceptId,
                'conceptName' => "Concept {$conceptId}",
                'recordCount' => 0,
                'genderDistribution' => [],
                'ageDistribution' => null,
                'monthlyTrend' => [],
                'typeDistribution' => [],
            ];
        }

        $conceptName = $this->resolveConceptName($conceptId);
        $stratum1 = (string) $conceptId;

        // Record count for this concept (count analysis, stratum_1 = concept_id)
        $countRow = AchillesResult::forAnalysis($analysisMap['count'])
            ->withStratum(1, $stratum1)
            ->first();
        $recordCount = $countRow ? (int) $countRow->count_value : 0;

        // Gender distribution (gender analysis, stratum_1 = concept_id, stratum_2 = gender_concept_id)
        $genderRows = AchillesResult::forAnalysis($analysisMap['gender'])
            ->withStratum(1, $stratum1)
            ->get();
        $genderDistribution = $genderRows->map(fn ($row) => [
            'concept_id' => (int) $row->stratum_2,
            'concept_name' => self::GENDER_CONCEPTS[(int) $row->stratum_2] ?? $this->resolveConceptName((int) $row->stratum_2),
            'count' => (int) $row->count_value,
        ])->values()->toArray();

        // Age distribution (age_dist analysis, stratum_1 = concept_id)
        $ageDistribution = $this->extractDistribution($analysisMap['age_dist'], $stratum1);

        // Monthly trend (month analysis, stratum_1 = concept_id, stratum_2 = YYYYMM)
        $monthRows = AchillesResult::forAnalysis($analysisMap['month'])
            ->withStratum(1, $stratum1)
            ->get();
        $monthlyTrend = $monthRows->map(fn ($row) => [
            'year_month' => $row->stratum_2,
            'count' => (int) $row->count_value,
        ])->sortBy('year_month')->values()->toArray();

        // Type distribution (type analysis, stratum_1 = concept_id, stratum_2 = type_concept_id)
        $typeRows = AchillesResult::forAnalysis($analysisMap['type'])
            ->withStratum(1, $stratum1)
            ->get();

        $typeConceptIds = $typeRows->pluck('stratum_2')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->toArray();
        $typeNames = $this->batchResolveConceptNames($typeConceptIds);

        $typeDistribution = $typeRows->map(function ($row) use ($typeNames) {
            $typeConceptId = (int) $row->stratum_2;

            return [
                'concept_id' => $typeConceptId,
                'concept_name' => $typeNames[$typeConceptId] ?? "Concept {$typeConceptId}",
                'count' => (int) $row->count_value,
            ];
        })->values()->toArray();

        return [
            'conceptId' => $conceptId,
            'conceptName' => $conceptName,
            'recordCount' => $recordCount,
            'genderDistribution' => $genderDistribution,
            'ageDistribution' => $ageDistribution,
            'monthlyTrend' => $monthlyTrend,
            'typeDistribution' => $typeDistribution,
        ];
    }

    /**
     * Get temporal trends (concept by month) for a domain.
     *
     * Aggregates across all concepts to show total monthly volume for the domain.
     *
     * @return array<int, array{year_month: string, count: int}>
     */
    public function getTemporalTrends(Source $source, string $domain): array
    {
        $analysisMap = self::DOMAIN_ANALYSIS_MAP[$domain] ?? null;

        if ($analysisMap === null || ! isset($analysisMap['month'])) {
            return [];
        }

        $monthAnalysisId = $analysisMap['month'];

        // stratum_1 = concept_id, stratum_2 = YYYYMM
        // Aggregate across all concepts to get total per month
        $rows = AchillesResult::forAnalysis($monthAnalysisId)
            ->select('stratum_2', DB::raw('SUM(count_value) as total_count'))
            ->whereNotNull('stratum_2')
            ->groupBy('stratum_2')
            ->orderBy('stratum_2')
            ->get();

        return $rows->map(fn ($row) => [
            'year_month' => $row->stratum_2,
            'count' => (int) $row->total_count,
        ])->values()->toArray();
    }

    /**
     * Get distribution data (box plot) for a given distribution analysis.
     *
     * @return array<int, array{stratum_1: string|null, min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float, count: int}>
     */
    public function getDistribution(int $analysisId, ?string $stratum1 = null): array
    {
        $query = AchillesResultDist::forAnalysis($analysisId);

        if ($stratum1 !== null) {
            $query->where('stratum_1', $stratum1);
        }

        $rows = $query->get();

        return $rows->map(fn ($row) => [
            'stratum_1' => $row->stratum_1,
            'min' => (float) $row->min_value,
            'p10' => (float) $row->p10_value,
            'p25' => (float) $row->p25_value,
            'median' => (float) $row->median_value,
            'p75' => (float) $row->p75_value,
            'p90' => (float) $row->p90_value,
            'max' => (float) $row->max_value,
            'count' => (int) $row->count_value,
        ])->values()->toArray();
    }

    /**
     * Get list of available analyses that have results.
     *
     * @return array<int, array{analysis_id: int, analysis_name: string, category: string|null, row_count: int}>
     */
    public function getAvailableAnalyses(): array
    {
        // Join achilles_analysis with a count of rows in achilles_results per analysis_id
        $analyses = AchillesAnalysis::query()
            ->select('achilles_analysis.*')
            ->selectSub(
                AchillesResult::query()
                    ->selectRaw('COUNT(*)')
                    ->whereColumn('achilles_results.analysis_id', 'achilles_analysis.analysis_id'),
                'row_count'
            )
            ->having('row_count', '>', 0)
            ->orderBy('analysis_id')
            ->get();

        return $analyses->map(fn ($row) => [
            'analysis_id' => (int) $row->analysis_id,
            'analysis_name' => $row->analysis_name,
            'category' => $row->category,
            'row_count' => (int) $row->row_count,
        ])->values()->toArray();
    }

    /**
     * Get performance report.
     *
     * @return array<int, array{analysis_id: int, analysis_name: string|null, elapsed_seconds: float}>
     */
    public function getPerformanceReport(): array
    {
        $performances = AchillesPerformance::query()
            ->orderByDesc('elapsed_seconds')
            ->get();

        // Batch lookup analysis names
        $analysisIds = $performances->pluck('analysis_id')->unique()->values()->toArray();
        $analysisNames = AchillesAnalysis::whereIn('analysis_id', $analysisIds)
            ->pluck('analysis_name', 'analysis_id')
            ->toArray();

        return $performances->map(fn ($row) => [
            'analysis_id' => (int) $row->analysis_id,
            'analysis_name' => $analysisNames[$row->analysis_id] ?? null,
            'elapsed_seconds' => (float) $row->elapsed_seconds,
        ])->values()->toArray();
    }

    /**
     * Extract a single distribution record into a standardized box-plot structure.
     *
     * @return array{min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float}|null
     */
    private function extractDistribution(int $analysisId, ?string $stratum1 = null): ?array
    {
        $query = AchillesResultDist::forAnalysis($analysisId);

        if ($stratum1 !== null) {
            $query->where('stratum_1', $stratum1);
        }

        $row = $query->first();

        if ($row === null) {
            return null;
        }

        return [
            'min' => (float) $row->min_value,
            'p10' => (float) $row->p10_value,
            'p25' => (float) $row->p25_value,
            'median' => (float) $row->median_value,
            'p75' => (float) $row->p75_value,
            'p90' => (float) $row->p90_value,
            'max' => (float) $row->max_value,
        ];
    }

    /**
     * Get total person count from analysis 0.
     */
    private function getTotalPersonCount(): int
    {
        $row = AchillesResult::forAnalysis(0)->first();

        return $row ? (int) $row->count_value : 0;
    }

    /**
     * Resolve a single concept_id to its concept_name via the vocab connection.
     * Falls back to well-known gender concepts if vocab lookup fails.
     */
    private function resolveConceptName(int $conceptId): string
    {
        // Check well-known gender concepts first (avoids DB call for common lookups)
        if (isset(self::GENDER_CONCEPTS[$conceptId])) {
            return self::GENDER_CONCEPTS[$conceptId];
        }

        if ($conceptId === 0) {
            return 'No matching concept';
        }

        try {
            $concept = DB::connection('vocab')
                ->table('concept')
                ->where('concept_id', $conceptId)
                ->value('concept_name');

            return $concept ?? "Concept {$conceptId}";
        } catch (\Throwable) {
            return "Concept {$conceptId}";
        }
    }

    /**
     * Batch resolve concept IDs to names via the vocab connection.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, string>
     */
    private function batchResolveConceptNames(array $conceptIds): array
    {
        if (empty($conceptIds)) {
            return [];
        }

        // Start with well-known constants
        $resolved = [];
        $toLookup = [];

        foreach ($conceptIds as $id) {
            if (isset(self::GENDER_CONCEPTS[$id])) {
                $resolved[$id] = self::GENDER_CONCEPTS[$id];
            } elseif ($id === 0) {
                $resolved[$id] = 'No matching concept';
            } else {
                $toLookup[] = $id;
            }
        }

        if (! empty($toLookup)) {
            try {
                $vocabResults = DB::connection('vocab')
                    ->table('concept')
                    ->whereIn('concept_id', $toLookup)
                    ->pluck('concept_name', 'concept_id')
                    ->toArray();

                foreach ($vocabResults as $id => $name) {
                    $resolved[(int) $id] = $name;
                }
            } catch (\Throwable) {
                // If vocab connection fails, use placeholder names
            }
        }

        return $resolved;
    }
}
