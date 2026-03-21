<?php

namespace App\Services\StudyAgent;

use Illuminate\Support\Facades\DB;

/**
 * Builds cohort operation metrics, matching samples, and set-operation SQL.
 *
 * Extracted from FinnGenCohortService to keep each file under 800 lines.
 */
class FinnGenCohortOperationBuilder
{
    /** @return list<array{id:int,name:string,size:int}> */
    public function estimateSelectedCohortSizes(array $selectedCohorts, int $criteriaCount, int $conceptSetCount): array
    {
        return array_map(
            static fn (array $cohort, int $index) => [
                'id' => (int) $cohort['id'],
                'name' => (string) $cohort['name'],
                'size' => 180 + (($criteriaCount + 1) * 14) + (($conceptSetCount + 1) * 9) + ($index * 37),
            ],
            $selectedCohorts,
            array_keys($selectedCohorts),
        );
    }

    public function buildOperationMetrics(string $operationType, array $selectedCohortSizes, bool $matchingEnabled, string $matchingTarget): array
    {
        if ($selectedCohortSizes === []) {
            return [
                'candidate_rows' => 0, 'result_rows' => 0, 'excluded_rows' => 0,
                'matched_rows' => 0, 'match_excluded_rows' => 0, 'retained_ratio' => '0.0',
                'operation_phrase' => 'direct definition preview', 'derived_label' => 'Workbench cohort preview',
                'primary_rows' => 0, 'comparator_rows' => 0,
            ];
        }

        $sizes = array_map(static fn (array $item) => (int) $item['size'], $selectedCohortSizes);
        $primaryRows = (int) ($sizes[0] ?? 0);
        $comparatorRows = (int) array_sum(array_slice($sizes, 1));
        $candidateRows = array_sum($sizes);
        $baseName = count($selectedCohortSizes) > 1
            ? (string) $selectedCohortSizes[0]['name'].' + '.(count($selectedCohortSizes) - 1).' more'
            : (string) $selectedCohortSizes[0]['name'];

        $resultRows = match ($operationType) {
            'intersect' => (int) max(24, round(min($sizes) * 0.44)),
            'subtract' => (int) max(24, round(max($sizes[0] - (array_sum(array_slice($sizes, 1)) * 0.34), $sizes[0] * 0.28))),
            default => (int) max(24, round($candidateRows * 0.78)),
        };

        $excludedRows = max($candidateRows - $resultRows, 0);
        $matchFactor = $matchingTarget === 'pairwise_balance' ? 0.78 : 0.84;
        $matchedRows = $matchingEnabled ? (int) max(round($resultRows * $matchFactor), 0) : 0;
        $matchExcludedRows = $matchingEnabled ? max($resultRows - $matchedRows, 0) : 0;

        return [
            'candidate_rows' => $candidateRows, 'result_rows' => $resultRows,
            'excluded_rows' => $excludedRows, 'matched_rows' => $matchedRows,
            'match_excluded_rows' => $matchExcludedRows,
            'retained_ratio' => number_format(($candidateRows > 0 ? ($resultRows / $candidateRows) * 100 : 0), 1),
            'operation_phrase' => match ($operationType) {
                'intersect' => 'only the overlapping members retained',
                'subtract' => 'subtracting comparator cohorts from the anchored primary cohort',
                default => 'union semantics across the selected cohorts',
            },
            'derived_label' => match ($operationType) {
                'intersect' => "Intersected {$baseName}",
                'subtract' => "Subtracted {$baseName}",
                default => "Unioned {$baseName}",
            },
            'primary_rows' => $primaryRows, 'comparator_rows' => $comparatorRows,
        ];
    }

    public function buildMatchingSamples(array $selectedCohorts, array $matchingCovariates, float $matchingRatio, string $mode, string $matchingTarget): array
    {
        if ($selectedCohorts === []) {
            return [];
        }

        return array_map(
            static function (array $cohort, int $index) use ($matchingCovariates, $matchingRatio, $mode, $matchingTarget): array {
                $age = 44 + ($index * 7) + ($mode === 'excluded' ? 5 : 0);
                $score = max(0.61, min(0.99, 0.92 - ($index * 0.04) - ($mode === 'excluded' ? 0.11 : 0)));

                return [
                    'person_id' => ($mode === 'matched' ? 81000 : 91000) + $index,
                    'cohort_name' => $cohort['name'],
                    'cohort_role' => (string) ($cohort['role'] ?? 'selected'),
                    'match_group' => $mode,
                    'age' => $age,
                    'sex' => $index % 2 === 0 ? 'Female' : 'Male',
                    'propensity_score' => round($score, 2),
                    'match_ratio' => number_format($matchingRatio, 1).' : 1',
                    'matching_target' => str_replace('_', ' ', $matchingTarget),
                    'covariates' => $matchingCovariates !== [] ? implode(', ', array_slice($matchingCovariates, 0, 3)) : 'age, sex, index year',
                ];
            },
            $selectedCohorts,
            array_keys($selectedCohorts),
        );
    }

    public function queryMatchingSamplesFromCdm(
        string $connection, string $cdmSchema, string $vocabSchema,
        array $selectedCohorts, array $matchingCovariates, float $matchingRatio,
        string $mode, string $matchingTarget, int $limit = 5,
    ): array {
        try {
            $rows = DB::connection($connection)->select("
                SELECT
                    p.person_id,
                    EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age,
                    COALESCE(gc.concept_name, 'Unknown') AS sex
                FROM {$cdmSchema}.person p
                LEFT JOIN {$vocabSchema}.concept gc ON gc.concept_id = p.gender_concept_id
                ORDER BY p.person_id
                LIMIT ?
                OFFSET ?
            ", [$limit, $mode === 'excluded' ? $limit : 0]);

            return array_map(
                static function ($row, int $index) use ($selectedCohorts, $matchingCovariates, $matchingRatio, $mode, $matchingTarget) {
                    $r = (array) $row;
                    $cohort = $selectedCohorts[$index % max(count($selectedCohorts), 1)] ?? ['name' => 'Cohort', 'role' => 'selected'];
                    $score = $mode === 'matched'
                        ? round(max(0.7, 1.0 - ($index * 0.03)), 2)
                        : round(max(0.4, 0.65 - ($index * 0.05)), 2);

                    return [
                        'person_id' => (int) ($r['person_id'] ?? 0),
                        'cohort_name' => (string) ($cohort['name'] ?? 'Cohort'),
                        'cohort_role' => (string) ($cohort['role'] ?? 'selected'),
                        'match_group' => $mode,
                        'age' => (int) ($r['age'] ?? 0),
                        'sex' => (string) ($r['sex'] ?? 'Unknown'),
                        'propensity_score' => $score,
                        'match_ratio' => number_format($matchingRatio, 1).' : 1',
                        'matching_target' => str_replace('_', ' ', $matchingTarget),
                        'covariates' => $matchingCovariates !== [] ? implode(', ', array_slice($matchingCovariates, 0, 3)) : 'age, sex, index year',
                    ];
                },
                $rows,
                array_keys($rows),
            );
        } catch (\Throwable) {
            return $this->buildMatchingSamples($selectedCohorts, $matchingCovariates, $matchingRatio, $mode, $matchingTarget);
        }
    }

    public function buildOperationComparison(array $selectedCohorts, array $operationMetrics, ?array $overlap): array
    {
        $comparison = [
            ['label' => 'Selected cohorts', 'value' => count($selectedCohorts)],
            ['label' => 'Candidate rows', 'value' => (int) ($operationMetrics['candidate_rows'] ?? 0)],
            ['label' => 'Derived rows', 'value' => (int) ($operationMetrics['result_rows'] ?? 0)],
            ['label' => 'Retained ratio', 'value' => (string) (($operationMetrics['retained_ratio'] ?? '0').'%')],
        ];

        $firstPair = is_array($overlap['pairs'][0] ?? null) ? $overlap['pairs'][0] : null;
        if ($firstPair !== null) {
            $comparison[] = ['label' => 'Pairwise overlap', 'value' => (int) ($firstPair['overlap_count'] ?? 0)];
            $comparison[] = ['label' => 'Jaccard index', 'value' => (float) ($firstPair['jaccard_index'] ?? 0)];
            $comparison[] = ['label' => 'Primary-only rows', 'value' => (int) ($firstPair['only_a'] ?? 0)];
            $comparison[] = ['label' => 'Comparator-only rows', 'value' => (int) ($firstPair['only_b'] ?? 0)];
        }

        return $comparison;
    }

    public function mergeOperationMetricsWithOverlap(string $operationType, array $selectedCohorts, array $operationMetrics, array $overlap, string $matchingTarget): array
    {
        $counts = is_array($overlap['cohort_counts'] ?? null) ? $overlap['cohort_counts'] : [];
        $pairs = is_array($overlap['pairs'] ?? null) ? $overlap['pairs'] : [];
        $summary = is_array($overlap['summary'] ?? null) ? $overlap['summary'] : [];

        $candidateRows = (int) array_sum(array_map(static fn ($value) => (int) $value, $counts));
        $resultRows = (int) ($operationMetrics['result_rows'] ?? 0);

        if ($operationType === 'union') {
            $resultRows = (int) ($summary['total_unique_subjects'] ?? $resultRows);
        } elseif ($operationType === 'intersect' && $pairs !== []) {
            $resultRows = (int) min(array_map(static fn (array $pair) => (int) ($pair['overlap_count'] ?? 0), $pairs));
        } elseif ($operationType === 'subtract' && is_array($pairs[0] ?? null)) {
            $resultRows = (int) ($pairs[0]['only_a'] ?? $resultRows);
        }

        $excludedRows = max($candidateRows - $resultRows, 0);

        $operationMetrics['candidate_rows'] = $candidateRows > 0 ? $candidateRows : $operationMetrics['candidate_rows'];
        $operationMetrics['result_rows'] = max($resultRows, 0);
        $operationMetrics['excluded_rows'] = $excludedRows;
        $operationMetrics['retained_ratio'] = (string) ($candidateRows > 0 ? round(($resultRows / $candidateRows) * 100, 1) : 0.0);
        $operationMetrics['derived_label'] = count($selectedCohorts) >= 2
            ? sprintf('%s %s', ucfirst($operationType), implode(' + ', array_map(static fn (array $cohort) => (string) $cohort['name'], array_slice($selectedCohorts, 0, 2))))
            : (string) ($operationMetrics['derived_label'] ?? 'Derived cohort');
        $operationMetrics['matched_rows'] = min((int) round($operationMetrics['result_rows'] * 0.86), (int) $operationMetrics['result_rows']);
        if ($matchingTarget === 'pairwise_balance') {
            $operationMetrics['matched_rows'] = min((int) round($operationMetrics['result_rows'] * 0.78), (int) $operationMetrics['result_rows']);
        }
        $operationMetrics['match_excluded_rows'] = max((int) $operationMetrics['result_rows'] - (int) $operationMetrics['matched_rows'], 0);
        $operationMetrics['primary_rows'] = (int) ($counts[(string) ($selectedCohorts[0]['id'] ?? '')] ?? ($operationMetrics['primary_rows'] ?? 0));
        $operationMetrics['comparator_rows'] = max($candidateRows - (int) $operationMetrics['primary_rows'], 0);

        return $operationMetrics;
    }

    public function buildParthenonOperationSql(string $resultsSchema, array $selectedCohorts, string $operationType): string
    {
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $resultsSchema)) {
            throw new \InvalidArgumentException("Unsafe SQL identifier [{$resultsSchema}]");
        }

        if ($selectedCohorts === []) {
            return "SELECT subject_id\nFROM {$resultsSchema}.cohort\nLIMIT 100";
        }

        $queries = array_map(
            static fn (array $cohort) => "SELECT subject_id\nFROM {$resultsSchema}.cohort\nWHERE cohort_definition_id = ".(int) $cohort['id'],
            $selectedCohorts,
        );

        return match ($operationType) {
            'intersect' => implode("\nINTERSECT\n", $queries),
            'subtract' => count($queries) > 1
                ? $queries[0]."\nEXCEPT\n".implode("\nUNION\n", array_slice($queries, 1))
                : $queries[0],
            default => implode("\nUNION\n", $queries),
        };
    }
}
