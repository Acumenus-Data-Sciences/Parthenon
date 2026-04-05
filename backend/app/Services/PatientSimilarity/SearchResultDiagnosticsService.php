<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

final class SearchResultDiagnosticsService
{
    /**
     * @param  array<string, mixed>  $seedData
     * @param  array<int, array<string, mixed>>  $resultVectors
     * @param  array<int, array<string, mixed>>|null  $referenceVectors
     * @return array<string, mixed>
     */
    public function build(array $seedData, array $resultVectors, ?array $referenceVectors = null): array
    {
        $resultProfile = $this->buildProfile($resultVectors);
        $balance = $referenceVectors !== null && $referenceVectors !== []
            ? $this->buildBalanceDiagnostics($referenceVectors, $resultVectors)
            : [
                'applicable' => false,
                'reference' => 'single_patient',
                'verdict' => 'not_applicable',
                'covariates' => [],
            ];

        return [
            'result_profile' => $resultProfile,
            'balance' => $balance,
            'warnings' => $this->buildWarnings($seedData, $resultProfile, $balance),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $vectors
     * @return array<string, mixed>
     */
    private function buildProfile(array $vectors): array
    {
        $count = count($vectors);

        if ($count === 0) {
            return [
                'result_count' => 0,
                'dimension_coverage' => [],
                'age_summary' => [],
                'gender_distribution' => [],
                'race_distribution' => [],
                'anchor_date' => [
                    'coverage' => 0.0,
                    'min' => null,
                    'max' => null,
                ],
            ];
        }

        $ageBuckets = [];
        $genderCounts = [];
        $raceCounts = [];
        $anchorDates = [];
        $dimensionCoverage = [
            'demographics' => 1.0,
            'conditions' => 0,
            'measurements' => 0,
            'drugs' => 0,
            'procedures' => 0,
            'genomics' => 0,
        ];

        foreach ($vectors as $vector) {
            $ageBucket = $vector['age_bucket'] ?? null;
            if (is_numeric($ageBucket)) {
                $ageBuckets[] = (int) $ageBucket;
            }

            $gender = $vector['gender_concept_id'] ?? null;
            if (is_numeric($gender)) {
                $genderKey = (int) $gender;
                $genderCounts[$genderKey] = ($genderCounts[$genderKey] ?? 0) + 1;
            }

            $race = $vector['race_concept_id'] ?? null;
            if (is_numeric($race)) {
                $raceKey = (int) $race;
                $raceCounts[$raceKey] = ($raceCounts[$raceKey] ?? 0) + 1;
            }

            $anchorDate = $vector['anchor_date'] ?? null;
            if (is_string($anchorDate) && $anchorDate !== '') {
                $anchorDates[] = $anchorDate;
            }

            if (! empty($vector['condition_concepts'])) {
                $dimensionCoverage['conditions']++;
            }
            if (! empty($vector['lab_vector'])) {
                $dimensionCoverage['measurements']++;
            }
            if (! empty($vector['drug_concepts'])) {
                $dimensionCoverage['drugs']++;
            }
            if (! empty($vector['procedure_concepts'])) {
                $dimensionCoverage['procedures']++;
            }
            if (! empty($vector['variant_genes'])) {
                $dimensionCoverage['genomics']++;
            }
        }

        foreach ($dimensionCoverage as $key => $value) {
            if ($key === 'demographics') {
                continue;
            }
            $dimensionCoverage[$key] = round($value / $count, 4);
        }

        sort($anchorDates);

        return [
            'result_count' => $count,
            'dimension_coverage' => $dimensionCoverage,
            'age_summary' => $this->summarizeAgeBuckets($ageBuckets),
            'gender_distribution' => $this->formatCategoricalDistribution($genderCounts, $count, true),
            'race_distribution' => $this->formatCategoricalDistribution($raceCounts, $count, false),
            'anchor_date' => [
                'coverage' => round(count($anchorDates) / $count, 4),
                'min' => $anchorDates[0] ?? null,
                'max' => $anchorDates[count($anchorDates) - 1] ?? null,
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $referenceVectors
     * @param  array<int, array<string, mixed>>  $resultVectors
     * @return array<string, mixed>
     */
    private function buildBalanceDiagnostics(array $referenceVectors, array $resultVectors): array
    {
        if ($referenceVectors === [] || $resultVectors === []) {
            return [
                'applicable' => false,
                'reference' => 'seed_cohort',
                'verdict' => 'insufficient_data',
                'covariates' => [],
            ];
        }

        $covariates = [];

        $ageSmd = $this->computeContinuousSmd(
            array_values(array_filter(array_map(fn (array $v): ?float => is_numeric($v['age_bucket'] ?? null) ? (float) $v['age_bucket'] : null, $referenceVectors), fn (?float $v): bool => $v !== null)),
            array_values(array_filter(array_map(fn (array $v): ?float => is_numeric($v['age_bucket'] ?? null) ? (float) $v['age_bucket'] : null, $resultVectors), fn (?float $v): bool => $v !== null)),
        );

        if ($ageSmd !== null) {
            $covariates[] = [
                'covariate_name' => 'Age bucket',
                'reference_proportion' => null,
                'result_proportion' => null,
                'smd' => round($ageSmd, 4),
            ];
        }

        foreach ($this->collectConceptLevels($referenceVectors, $resultVectors, 'gender_concept_id') as $conceptId) {
            $covariates[] = $this->buildBinaryBalanceRow(
                'Gender: '.$this->labelGender($conceptId),
                $referenceVectors,
                $resultVectors,
                'gender_concept_id',
                $conceptId,
            );
        }

        foreach ($this->collectConceptLevels($referenceVectors, $resultVectors, 'race_concept_id') as $conceptId) {
            $covariates[] = $this->buildBinaryBalanceRow(
                'Race: '.$this->labelRace($conceptId),
                $referenceVectors,
                $resultVectors,
                'race_concept_id',
                $conceptId,
            );
        }

        $validSmds = array_values(array_filter(
            array_map(fn (array $row): ?float => is_numeric($row['smd'] ?? null) ? abs((float) $row['smd']) : null, $covariates),
            fn (?float $value): bool => $value !== null,
        ));

        $meanAbsSmd = $validSmds !== []
            ? round(array_sum($validSmds) / count($validSmds), 4)
            : null;
        $highImbalance = count(array_filter($validSmds, fn (float $smd): bool => $smd >= 0.2));
        $moderateImbalance = count(array_filter($validSmds, fn (float $smd): bool => $smd >= 0.1));

        return [
            'applicable' => true,
            'reference' => 'seed_cohort',
            'verdict' => $this->classifyBalanceVerdict($meanAbsSmd, $highImbalance, $moderateImbalance),
            'mean_abs_smd' => $meanAbsSmd,
            'balanced_covariates' => count(array_filter($validSmds, fn (float $smd): bool => $smd < 0.1)),
            'imbalanced_covariates' => $moderateImbalance,
            'high_imbalance_covariates' => $highImbalance,
            'covariates' => $covariates,
        ];
    }

    /**
     * @param  array<string, mixed>  $seedData
     * @param  array<string, mixed>  $resultProfile
     * @param  array<string, mixed>  $balance
     * @return array<int, string>
     */
    private function buildWarnings(array $seedData, array $resultProfile, array $balance): array
    {
        $warnings = [];
        $resultCount = (int) ($resultProfile['result_count'] ?? 0);

        if ($resultCount < 10) {
            $warnings[] = 'Low result count limits stability and subgroup assessment.';
        }

        foreach (($resultProfile['dimension_coverage'] ?? []) as $dimension => $coverage) {
            if ($dimension === 'demographics') {
                continue;
            }

            if (is_numeric($coverage) && (float) $coverage < 0.5) {
                $warnings[] = ucfirst($dimension).' coverage is below 50% in the returned cohort.';
            }
        }

        $anchorCoverage = (float) (($resultProfile['anchor_date']['coverage'] ?? 0.0));
        if ($anchorCoverage < 0.9) {
            $warnings[] = 'Anchor-date completeness is below 90%, which weakens temporal comparability.';
        }

        if (($balance['applicable'] ?? false) === true) {
            $meanAbsSmd = $balance['mean_abs_smd'] ?? null;
            if (is_numeric($meanAbsSmd) && (float) $meanAbsSmd >= 0.1) {
                $warnings[] = 'Returned cohort is demographically imbalanced versus the seed cohort (mean |SMD| >= 0.1).';
            }
        }

        if (($seedData['feature_vector_version'] ?? $seedData['version'] ?? null) === null) {
            $warnings[] = 'Seed feature-vector provenance is incomplete.';
        }

        return array_values(array_unique($warnings));
    }

    /**
     * @param  array<int>  $counts
     * @return array<int, array<string, mixed>>
     */
    private function formatCategoricalDistribution(array $counts, int $total, bool $isGender): array
    {
        arsort($counts);

        $result = [];
        foreach ($counts as $conceptId => $count) {
            $result[] = [
                'concept_id' => $conceptId,
                'label' => $isGender ? $this->labelGender((int) $conceptId) : $this->labelRace((int) $conceptId),
                'count' => $count,
                'proportion' => $total > 0 ? round($count / $total, 4) : 0.0,
            ];
        }

        return $result;
    }

    /**
     * @param  array<int>  $ageBuckets
     * @return array<string, mixed>
     */
    private function summarizeAgeBuckets(array $ageBuckets): array
    {
        if ($ageBuckets === []) {
            return [];
        }

        sort($ageBuckets);
        $count = count($ageBuckets);

        return [
            'median_bucket' => $this->percentileValue($ageBuckets, 0.5),
            'p25_bucket' => $this->percentileValue($ageBuckets, 0.25),
            'p75_bucket' => $this->percentileValue($ageBuckets, 0.75),
            'median_age' => ((int) $this->percentileValue($ageBuckets, 0.5) * 5) + 2,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $referenceVectors
     * @param  array<int, array<string, mixed>>  $resultVectors
     * @return array<int>
     */
    private function collectConceptLevels(array $referenceVectors, array $resultVectors, string $field): array
    {
        $conceptIds = [];

        foreach ([$referenceVectors, $resultVectors] as $vectors) {
            foreach ($vectors as $vector) {
                $conceptId = $vector[$field] ?? null;
                if (is_numeric($conceptId)) {
                    $conceptIds[(int) $conceptId] = (int) $conceptId;
                }
            }
        }

        ksort($conceptIds);

        return array_values($conceptIds);
    }

    /**
     * @param  array<int, array<string, mixed>>  $referenceVectors
     * @param  array<int, array<string, mixed>>  $resultVectors
     * @return array<string, mixed>
     */
    private function buildBinaryBalanceRow(
        string $label,
        array $referenceVectors,
        array $resultVectors,
        string $field,
        int $conceptId,
    ): array {
        $referenceProportion = $this->binaryProportion($referenceVectors, $field, $conceptId);
        $resultProportion = $this->binaryProportion($resultVectors, $field, $conceptId);

        return [
            'covariate_name' => $label,
            'reference_proportion' => round($referenceProportion, 4),
            'result_proportion' => round($resultProportion, 4),
            'smd' => round($this->computeBinarySmd($referenceProportion, $resultProportion) ?? 0.0, 4),
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $vectors
     */
    private function binaryProportion(array $vectors, string $field, int $conceptId): float
    {
        if ($vectors === []) {
            return 0.0;
        }

        $matches = count(array_filter($vectors, fn (array $vector): bool => (int) ($vector[$field] ?? 0) === $conceptId));

        return $matches / count($vectors);
    }

    private function computeBinarySmd(float $p1, float $p2): ?float
    {
        $denominator = sqrt((($p1 * (1 - $p1)) + ($p2 * (1 - $p2))) / 2);

        if ($denominator === 0.0) {
            return null;
        }

        return abs($p1 - $p2) / $denominator;
    }

    /**
     * @param  array<int, float>  $reference
     * @param  array<int, float>  $result
     */
    private function computeContinuousSmd(array $reference, array $result): ?float
    {
        if ($reference === [] || $result === []) {
            return null;
        }

        $meanReference = array_sum($reference) / count($reference);
        $meanResult = array_sum($result) / count($result);
        $varianceReference = $this->variance($reference, $meanReference);
        $varianceResult = $this->variance($result, $meanResult);
        $denominator = sqrt(($varianceReference + $varianceResult) / 2);

        if ($denominator === 0.0) {
            return null;
        }

        return abs($meanReference - $meanResult) / $denominator;
    }

    /**
     * @param  array<int, float>  $values
     */
    private function variance(array $values, float $mean): float
    {
        if (count($values) < 2) {
            return 0.0;
        }

        $sumSquares = array_sum(array_map(
            fn (float $value): float => ($value - $mean) ** 2,
            $values,
        ));

        return $sumSquares / (count($values) - 1);
    }

    /**
     * @param  array<int, int>  $sortedValues
     */
    private function percentileValue(array $sortedValues, float $percentile): float
    {
        $count = count($sortedValues);
        if ($count === 1) {
            return (float) $sortedValues[0];
        }

        $position = ($count - 1) * $percentile;
        $lower = (int) floor($position);
        $upper = (int) ceil($position);

        if ($lower === $upper) {
            return (float) $sortedValues[$lower];
        }

        $fraction = $position - $lower;

        return $sortedValues[$lower] + (($sortedValues[$upper] - $sortedValues[$lower]) * $fraction);
    }

    private function classifyBalanceVerdict(?float $meanAbsSmd, int $highImbalance, int $moderateImbalance): string
    {
        if ($meanAbsSmd === null) {
            return 'insufficient_data';
        }

        if ($highImbalance > 0 || $meanAbsSmd >= 0.2) {
            return 'significant_imbalance';
        }

        if ($moderateImbalance > 0 || $meanAbsSmd >= 0.1) {
            return 'marginal_imbalance';
        }

        return 'well_balanced';
    }

    private function labelGender(int $conceptId): string
    {
        return match ($conceptId) {
            8507 => 'Male',
            8532 => 'Female',
            8551 => 'Unknown',
            default => "Concept {$conceptId}",
        };
    }

    private function labelRace(int $conceptId): string
    {
        return match ($conceptId) {
            8527 => 'White',
            8516 => 'Black or African American',
            8515 => 'Asian',
            8557 => 'Native Hawaiian or Other Pacific Islander',
            8567 => 'American Indian or Alaska Native',
            default => "Concept {$conceptId}",
        };
    }
}
