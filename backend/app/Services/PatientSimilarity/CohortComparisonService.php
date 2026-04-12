<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use Illuminate\Support\Facades\DB;

final class CohortComparisonService
{
    /**
     * Compute per-covariate standardized mean differences (SMD) across all domains.
     *
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     * @return array<int, array{covariate: string, smd: float, type: string, domain: string}>
     */
    public function computeCovariateBalance(array $sourceVectors, array $targetVectors): array
    {
        if ($sourceVectors === [] || $targetVectors === []) {
            return [];
        }

        $covariates = [];

        // Age bucket (continuous)
        $sourceAges = $this->extractNumericField($sourceVectors, 'age_bucket');
        $targetAges = $this->extractNumericField($targetVectors, 'age_bucket');
        $ageSmd = $this->computeContinuousSmd($sourceAges, $targetAges);
        if ($ageSmd !== null) {
            $covariates[] = [
                'covariate' => 'Age bucket',
                'smd' => round($ageSmd, 4),
                'type' => 'continuous',
                'domain' => 'demographics',
            ];
        }

        // Gender levels (binary)
        $this->addBinaryLevels(
            $covariates,
            $sourceVectors,
            $targetVectors,
            'gender_concept_id',
            'demographics',
            fn (int $id): string => 'Gender: '.$this->labelGender($id),
        );

        // Race levels (binary)
        $this->addBinaryLevels(
            $covariates,
            $sourceVectors,
            $targetVectors,
            'race_concept_id',
            'demographics',
            fn (int $id): string => 'Race: '.$this->labelRace($id),
        );

        // Condition concepts (binary, top 30 by |SMD|)
        $conditionRows = $this->computeConceptSetSmd($sourceVectors, $targetVectors, 'condition_concepts', 'conditions');
        usort($conditionRows, fn (array $a, array $b): int => $b['abs_smd'] <=> $a['abs_smd']);
        foreach (array_slice($conditionRows, 0, 30) as $row) {
            unset($row['abs_smd']);
            $covariates[] = $row;
        }

        // Drug concepts (binary, top 20 by |SMD|)
        $drugRows = $this->computeConceptSetSmd($sourceVectors, $targetVectors, 'drug_concepts', 'drugs');
        usort($drugRows, fn (array $a, array $b): int => $b['abs_smd'] <=> $a['abs_smd']);
        foreach (array_slice($drugRows, 0, 20) as $row) {
            unset($row['abs_smd']);
            $covariates[] = $row;
        }

        // Procedure concepts (binary, top 10 by |SMD|)
        $procRows = $this->computeConceptSetSmd($sourceVectors, $targetVectors, 'procedure_concepts', 'procedures');
        usort($procRows, fn (array $a, array $b): int => $b['abs_smd'] <=> $a['abs_smd']);
        foreach (array_slice($procRows, 0, 10) as $row) {
            unset($row['abs_smd']);
            $covariates[] = $row;
        }

        // Resolve concept names for clinical covariates
        $this->resolveConceptNames($covariates);

        // Sort by |smd| descending
        usort($covariates, fn (array $a, array $b): int => (int) (abs($b['smd']) * 10000) <=> (int) (abs($a['smd']) * 10000));

        return $covariates;
    }

    /**
     * Compute distributional divergence using JSD for categorical and Wasserstein for continuous dimensions.
     *
     * @param  array<string, mixed>  $sourceCentroid
     * @param  array<string, mixed>  $targetCentroid
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     * @return array<int, array{dimension: string, metric: string, value: float, interpretation: string}>
     */
    public function computeDistributionalDivergence(
        array $sourceCentroid,
        array $targetCentroid,
        array $sourceVectors,
        array $targetVectors,
    ): array {
        $results = [];

        // Demographics: JSD over age bucket + gender distributions
        $demoJsd = $this->computeDemographicsJsd($sourceVectors, $targetVectors);
        if ($demoJsd !== null) {
            $results[] = [
                'dimension' => 'demographics',
                'metric' => 'jsd',
                'value' => round($demoJsd, 4),
                'interpretation' => $this->interpretJsd($demoJsd),
            ];
        }

        // Conditions: JSD over concept prevalence
        $condJsd = $this->computeConceptPrevalenceJsd($sourceVectors, $targetVectors, 'condition_concepts');
        if ($condJsd !== null) {
            $results[] = [
                'dimension' => 'conditions',
                'metric' => 'jsd',
                'value' => round($condJsd, 4),
                'interpretation' => $this->interpretJsd($condJsd),
            ];
        }

        // Drugs: JSD
        $drugJsd = $this->computeConceptPrevalenceJsd($sourceVectors, $targetVectors, 'drug_concepts');
        if ($drugJsd !== null) {
            $results[] = [
                'dimension' => 'drugs',
                'metric' => 'jsd',
                'value' => round($drugJsd, 4),
                'interpretation' => $this->interpretJsd($drugJsd),
            ];
        }

        // Procedures: JSD
        $procJsd = $this->computeConceptPrevalenceJsd($sourceVectors, $targetVectors, 'procedure_concepts');
        if ($procJsd !== null) {
            $results[] = [
                'dimension' => 'procedures',
                'metric' => 'jsd',
                'value' => round($procJsd, 4),
                'interpretation' => $this->interpretJsd($procJsd),
            ];
        }

        // Measurements: Wasserstein-1 distance over lab z-scores
        $wasserstein = $this->computeLabWasserstein($sourceVectors, $targetVectors);
        if ($wasserstein !== null) {
            $results[] = [
                'dimension' => 'measurements',
                'metric' => 'wasserstein',
                'value' => round($wasserstein, 4),
                'interpretation' => $this->interpretWasserstein($wasserstein),
            ];
        }

        // Genomics: JSD over gene presence/absence
        $genomicsJsd = $this->computeGenomicsJsd($sourceVectors, $targetVectors);
        if ($genomicsJsd !== null) {
            $results[] = [
                'dimension' => 'genomics',
                'metric' => 'jsd',
                'value' => round($genomicsJsd, 4),
                'interpretation' => $this->interpretJsd($genomicsJsd),
            ];
        }

        return $results;
    }

    // ── SMD helpers ──────────────────────────────────────────────────

    /**
     * @param  array<int, array<string, mixed>>  $vectors
     * @return array<int, float>
     */
    private function extractNumericField(array $vectors, string $field): array
    {
        $values = [];
        foreach ($vectors as $v) {
            $val = $v[$field] ?? null;
            if (is_numeric($val)) {
                $values[] = (float) $val;
            }
        }

        return $values;
    }

    /**
     * @param  array<int, float>  $a
     * @param  array<int, float>  $b
     */
    private function computeContinuousSmd(array $a, array $b): ?float
    {
        if ($a === [] || $b === []) {
            return null;
        }

        $meanA = array_sum($a) / count($a);
        $meanB = array_sum($b) / count($b);
        $varA = $this->variance($a, $meanA);
        $varB = $this->variance($b, $meanB);
        $denom = sqrt(($varA + $varB) / 2);

        return $denom === 0.0 ? null : abs($meanA - $meanB) / $denom;
    }

    /**
     * @param  array<int, float>  $values
     */
    private function variance(array $values, float $mean): float
    {
        if (count($values) < 2) {
            return 0.0;
        }

        $sumSq = 0.0;
        foreach ($values as $v) {
            $sumSq += ($v - $mean) ** 2;
        }

        return $sumSq / (count($values) - 1);
    }

    private function computeBinarySmd(float $p1, float $p2): ?float
    {
        $denom = sqrt((($p1 * (1 - $p1)) + ($p2 * (1 - $p2))) / 2);

        return $denom === 0.0 ? null : abs($p1 - $p2) / $denom;
    }

    /**
     * @param  array<int, array{covariate: string, smd: float, type: string, domain: string}>  $covariates
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     */
    private function addBinaryLevels(
        array &$covariates,
        array $sourceVectors,
        array $targetVectors,
        string $field,
        string $domain,
        \Closure $labelFn,
    ): void {
        $levels = [];
        foreach ([$sourceVectors, $targetVectors] as $vectors) {
            foreach ($vectors as $v) {
                $val = $v[$field] ?? null;
                if (is_numeric($val)) {
                    $levels[(int) $val] = true;
                }
            }
        }

        $sourceCount = count($sourceVectors);
        $targetCount = count($targetVectors);

        foreach (array_keys($levels) as $conceptId) {
            $sourceProp = $this->proportionWithValue($sourceVectors, $field, $conceptId) / max($sourceCount, 1);
            $targetProp = $this->proportionWithValue($targetVectors, $field, $conceptId) / max($targetCount, 1);
            $smd = $this->computeBinarySmd($sourceProp, $targetProp);

            if ($smd !== null) {
                $covariates[] = [
                    'covariate' => $labelFn($conceptId),
                    'smd' => round($smd, 4),
                    'type' => 'binary',
                    'domain' => $domain,
                ];
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $vectors
     */
    private function proportionWithValue(array $vectors, string $field, int $conceptId): float
    {
        $matches = 0;
        foreach ($vectors as $v) {
            if ((int) ($v[$field] ?? 0) === $conceptId) {
                $matches++;
            }
        }

        return (float) $matches;
    }

    /**
     * Compute binary SMD for each concept_id in a concept set field (condition_concepts, drug_concepts, etc).
     *
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     * @return array<int, array{covariate: string, smd: float, type: string, domain: string, abs_smd: float}>
     */
    private function computeConceptSetSmd(array $sourceVectors, array $targetVectors, string $field, string $domain): array
    {
        // Collect all concept_ids present in either cohort
        /** @var array<int, true> $allConcepts */
        $allConcepts = [];
        foreach ([$sourceVectors, $targetVectors] as $vectors) {
            foreach ($vectors as $v) {
                $concepts = $v[$field] ?? [];
                if (is_array($concepts)) {
                    foreach ($concepts as $cid) {
                        if (is_numeric($cid)) {
                            $allConcepts[(int) $cid] = true;
                        }
                    }
                }
            }
        }

        if ($allConcepts === []) {
            return [];
        }

        $sourceCount = count($sourceVectors);
        $targetCount = count($targetVectors);

        // Build prevalence lookup for source
        /** @var array<int, int> $sourcePrevalence */
        $sourcePrevalence = [];
        foreach ($sourceVectors as $v) {
            $concepts = $v[$field] ?? [];
            if (is_array($concepts)) {
                foreach ($concepts as $cid) {
                    if (is_numeric($cid)) {
                        $key = (int) $cid;
                        $sourcePrevalence[$key] = ($sourcePrevalence[$key] ?? 0) + 1;
                    }
                }
            }
        }

        /** @var array<int, int> $targetPrevalence */
        $targetPrevalence = [];
        foreach ($targetVectors as $v) {
            $concepts = $v[$field] ?? [];
            if (is_array($concepts)) {
                foreach ($concepts as $cid) {
                    if (is_numeric($cid)) {
                        $key = (int) $cid;
                        $targetPrevalence[$key] = ($targetPrevalence[$key] ?? 0) + 1;
                    }
                }
            }
        }

        $rows = [];
        foreach (array_keys($allConcepts) as $conceptId) {
            $sp = ($sourcePrevalence[$conceptId] ?? 0) / max($sourceCount, 1);
            $tp = ($targetPrevalence[$conceptId] ?? 0) / max($targetCount, 1);
            $smd = $this->computeBinarySmd($sp, $tp);

            if ($smd !== null && $smd > 0.0) {
                $rows[] = [
                    'covariate' => "concept:{$conceptId}",
                    'smd' => round($smd, 4),
                    'type' => 'binary',
                    'domain' => $domain,
                    'abs_smd' => $smd,
                ];
            }
        }

        return $rows;
    }

    /**
     * Resolve concept_id placeholders to concept_name via vocab.concept.
     *
     * @param  array<int, array<string, mixed>>  $covariates
     */
    private function resolveConceptNames(array &$covariates): void
    {
        $conceptIds = [];
        foreach ($covariates as $row) {
            if (preg_match('/^concept:(\d+)$/', $row['covariate'], $matches)) {
                $conceptIds[(int) $matches[1]] = true;
            }
        }

        if ($conceptIds === []) {
            return;
        }

        $ids = array_keys($conceptIds);
        $names = DB::connection('omop')
            ->table('concept')
            ->whereIn('concept_id', $ids)
            ->pluck('concept_name', 'concept_id')
            ->all();

        foreach ($covariates as &$row) {
            if (preg_match('/^concept:(\d+)$/', $row['covariate'], $matches)) {
                $cid = (int) $matches[1];
                $row['covariate'] = $names[$cid] ?? "Concept {$cid}";
            }
        }
    }

    // ── JSD / Wasserstein helpers ────────────────────────────────────

    /**
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     */
    private function computeConceptPrevalenceJsd(array $sourceVectors, array $targetVectors, string $field): ?float
    {
        $sourceCount = count($sourceVectors);
        $targetCount = count($targetVectors);

        if ($sourceCount === 0 || $targetCount === 0) {
            return null;
        }

        // Collect all concept IDs
        /** @var array<int, true> $allConcepts */
        $allConcepts = [];
        foreach ([$sourceVectors, $targetVectors] as $vectors) {
            foreach ($vectors as $v) {
                $concepts = $v[$field] ?? [];
                if (is_array($concepts)) {
                    foreach ($concepts as $cid) {
                        if (is_numeric($cid)) {
                            $allConcepts[(int) $cid] = true;
                        }
                    }
                }
            }
        }

        if ($allConcepts === []) {
            return null;
        }

        // Build prevalence distributions
        /** @var array<int, float> $p */
        $p = [];
        /** @var array<int, float> $q */
        $q = [];

        foreach (array_keys($allConcepts) as $conceptId) {
            $p[$conceptId] = 0.0;
            $q[$conceptId] = 0.0;
        }

        foreach ($sourceVectors as $v) {
            $concepts = $v[$field] ?? [];
            if (is_array($concepts)) {
                foreach ($concepts as $cid) {
                    if (is_numeric($cid)) {
                        $p[(int) $cid] = ($p[(int) $cid] ?? 0.0) + (1.0 / $sourceCount);
                    }
                }
            }
        }

        foreach ($targetVectors as $v) {
            $concepts = $v[$field] ?? [];
            if (is_array($concepts)) {
                foreach ($concepts as $cid) {
                    if (is_numeric($cid)) {
                        $q[(int) $cid] = ($q[(int) $cid] ?? 0.0) + (1.0 / $targetCount);
                    }
                }
            }
        }

        return $this->jensenShannonDivergence(array_values($p), array_values($q));
    }

    /**
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     */
    private function computeDemographicsJsd(array $sourceVectors, array $targetVectors): ?float
    {
        $sourceCount = count($sourceVectors);
        $targetCount = count($targetVectors);

        if ($sourceCount === 0 || $targetCount === 0) {
            return null;
        }

        // Build combined distribution over (age_bucket, gender_concept_id) pairs
        /** @var array<string, float> $p */
        $p = [];
        /** @var array<string, float> $q */
        $q = [];

        foreach ($sourceVectors as $v) {
            $key = ($v['age_bucket'] ?? 'unk').':'.(($v['gender_concept_id'] ?? 'unk'));
            $p[$key] = ($p[$key] ?? 0.0) + (1.0 / $sourceCount);
        }

        foreach ($targetVectors as $v) {
            $key = ($v['age_bucket'] ?? 'unk').':'.(($v['gender_concept_id'] ?? 'unk'));
            $q[$key] = ($q[$key] ?? 0.0) + (1.0 / $targetCount);
        }

        // Union keys
        $allKeys = array_unique(array_merge(array_keys($p), array_keys($q)));
        $pArr = [];
        $qArr = [];
        foreach ($allKeys as $k) {
            $pArr[] = $p[$k] ?? 0.0;
            $qArr[] = $q[$k] ?? 0.0;
        }

        return $this->jensenShannonDivergence($pArr, $qArr);
    }

    /**
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     */
    private function computeGenomicsJsd(array $sourceVectors, array $targetVectors): ?float
    {
        $sourceCount = count($sourceVectors);
        $targetCount = count($targetVectors);

        if ($sourceCount === 0 || $targetCount === 0) {
            return null;
        }

        // Collect all gene names
        /** @var array<string, true> $allGenes */
        $allGenes = [];
        foreach ([$sourceVectors, $targetVectors] as $vectors) {
            foreach ($vectors as $v) {
                $genes = $v['variant_genes'] ?? [];
                if (is_array($genes)) {
                    foreach ($genes as $g) {
                        if (is_array($g) && isset($g['gene'])) {
                            $allGenes[(string) $g['gene']] = true;
                        }
                    }
                }
            }
        }

        if ($allGenes === []) {
            return null;
        }

        /** @var array<string, float> $p */
        $p = [];
        /** @var array<string, float> $q */
        $q = [];

        foreach (array_keys($allGenes) as $gene) {
            $p[$gene] = 0.0;
            $q[$gene] = 0.0;
        }

        foreach ($sourceVectors as $v) {
            $genes = $v['variant_genes'] ?? [];
            if (is_array($genes)) {
                foreach ($genes as $g) {
                    if (is_array($g) && isset($g['gene'])) {
                        $geneName = (string) $g['gene'];
                        $p[$geneName] = ($p[$geneName] ?? 0.0) + (1.0 / $sourceCount);
                    }
                }
            }
        }

        foreach ($targetVectors as $v) {
            $genes = $v['variant_genes'] ?? [];
            if (is_array($genes)) {
                foreach ($genes as $g) {
                    if (is_array($g) && isset($g['gene'])) {
                        $geneName = (string) $g['gene'];
                        $q[$geneName] = ($q[$geneName] ?? 0.0) + (1.0 / $targetCount);
                    }
                }
            }
        }

        return $this->jensenShannonDivergence(array_values($p), array_values($q));
    }

    /**
     * Compute Wasserstein-1 (earth mover's distance) averaged across shared lab metrics.
     *
     * @param  array<int, array<string, mixed>>  $sourceVectors
     * @param  array<int, array<string, mixed>>  $targetVectors
     */
    private function computeLabWasserstein(array $sourceVectors, array $targetVectors): ?float
    {
        // Collect all lab keys
        /** @var array<string, true> $allKeys */
        $allKeys = [];
        foreach ([$sourceVectors, $targetVectors] as $vectors) {
            foreach ($vectors as $v) {
                $lab = $v['lab_vector'] ?? [];
                if (is_array($lab)) {
                    foreach (array_keys($lab) as $k) {
                        $allKeys[(string) $k] = true;
                    }
                }
            }
        }

        if ($allKeys === []) {
            return null;
        }

        $distances = [];
        foreach (array_keys($allKeys) as $labKey) {
            $sourceValues = [];
            $targetValues = [];

            foreach ($sourceVectors as $v) {
                $lab = $v['lab_vector'] ?? [];
                if (is_array($lab) && isset($lab[$labKey]) && is_numeric($lab[$labKey])) {
                    $sourceValues[] = (float) $lab[$labKey];
                }
            }

            foreach ($targetVectors as $v) {
                $lab = $v['lab_vector'] ?? [];
                if (is_array($lab) && isset($lab[$labKey]) && is_numeric($lab[$labKey])) {
                    $targetValues[] = (float) $lab[$labKey];
                }
            }

            if ($sourceValues === [] || $targetValues === []) {
                continue;
            }

            $distances[] = $this->wasserstein1d($sourceValues, $targetValues);
        }

        return $distances === [] ? null : array_sum($distances) / count($distances);
    }

    /**
     * 1D Wasserstein distance via sorted quantile comparison.
     *
     * @param  array<int, float>  $a
     * @param  array<int, float>  $b
     */
    private function wasserstein1d(array $a, array $b): float
    {
        sort($a);
        sort($b);

        $n = max(count($a), count($b));
        $resampledA = $this->resampleToLength($a, $n);
        $resampledB = $this->resampleToLength($b, $n);

        $sum = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $sum += abs($resampledA[$i] - $resampledB[$i]);
        }

        return $sum / $n;
    }

    /**
     * Resample sorted array to target length via linear interpolation.
     *
     * @param  array<int, float>  $sorted
     * @return array<int, float>
     */
    private function resampleToLength(array $sorted, int $targetLength): array
    {
        $n = count($sorted);
        if ($n === $targetLength) {
            return $sorted;
        }

        $result = [];
        for ($i = 0; $i < $targetLength; $i++) {
            $pos = ($n - 1) * $i / max($targetLength - 1, 1);
            $lower = (int) floor($pos);
            $upper = min($lower + 1, $n - 1);
            $frac = $pos - $lower;
            $result[] = $sorted[$lower] + ($sorted[$upper] - $sorted[$lower]) * $frac;
        }

        return $result;
    }

    /**
     * Jensen-Shannon divergence (base 2 log, result in [0, 1]).
     *
     * @param  array<int, float>  $p
     * @param  array<int, float>  $q
     */
    private function jensenShannonDivergence(array $p, array $q): float
    {
        $n = count($p);
        $m = [];
        for ($i = 0; $i < $n; $i++) {
            $m[$i] = 0.5 * ($p[$i] + $q[$i]);
        }

        return 0.5 * $this->klDivergence($p, $m) + 0.5 * $this->klDivergence($q, $m);
    }

    /**
     * KL divergence (base 2). Treats 0*log(0/q) = 0.
     *
     * @param  array<int, float>  $p
     * @param  array<int, float>  $q
     */
    private function klDivergence(array $p, array $q): float
    {
        $sum = 0.0;
        for ($i = 0, $n = count($p); $i < $n; $i++) {
            if ($p[$i] > 0.0 && $q[$i] > 0.0) {
                $sum += $p[$i] * log($p[$i] / $q[$i]) / log(2);
            }
        }

        return $sum;
    }

    // ── Interpretation helpers ───────────────────────────────────────

    private function interpretJsd(float $jsd): string
    {
        if ($jsd < 0.1) {
            return 'Very similar';
        }
        if ($jsd < 0.3) {
            return 'Similar';
        }
        if ($jsd < 0.5) {
            return 'Moderate';
        }

        return 'Divergent';
    }

    private function interpretWasserstein(float $w): string
    {
        if ($w < 0.2) {
            return 'Very similar';
        }
        if ($w < 0.5) {
            return 'Similar';
        }
        if ($w < 1.0) {
            return 'Moderate';
        }

        return 'Divergent';
    }

    // ── Label helpers ───────────────────────────────────────────────

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
