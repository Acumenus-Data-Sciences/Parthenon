<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS012 v2 – SCORE2 (European 10-year cardiovascular risk)
 *
 * Simplified point-based approximation of the ESC SCORE2 model for
 * 10-year fatal and non-fatal cardiovascular event risk.
 * Full model requires population-specific coefficients; this uses
 * a generalized point approach.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS012SCORE2V2 implements PopulationRiskScoreV2Interface
{
    /** OMOP gender_concept_id for male. */
    private const MALE = 8507;

    public function scoreId(): string
    {
        return 'RS012';
    }

    public function scoreName(): string
    {
        return 'SCORE2 (European CVD Risk)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Simplified ESC SCORE2 10-year cardiovascular risk estimate using total cholesterol, '
            .'HDL, and systolic blood pressure. Full model requires population-specific coefficients; '
            .'this uses a generalized point-based approximation. Diabetes counted separately. '
            .'Tiers: low (<2%), intermediate (2-4%), high (5-9%), very high (10%+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Adults aged 40–69 years';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'age_restricted',
            'min_age' => 40,
            'max_age' => 69,
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Total cholesterol', 'concept_id' => 3027114, 'unit' => 'mmol/L'],
            ['label' => 'HDL cholesterol', 'concept_id' => 3007070, 'unit' => 'mmol/L'],
            ['label' => 'Systolic blood pressure', 'concept_id' => 3004249, 'unit' => 'mmHg'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 2],
            'intermediate' => [2, 5],
            'high' => [5, 10],
            'very_high' => [10, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $age = $patientData['age'];
        $isMale = $patientData['gender_concept_id'] === self::MALE;
        $conditions = array_flip($patientData['conditions']);
        $measurements = $patientData['measurements'] ?? [];

        $hasDiabetes = isset($conditions[201820]);

        // Track which labs are present
        $hasTotalChol = isset($measurements[3027114]);
        $hasHdl = isset($measurements[3007070]);
        $hasSbp = isset($measurements[3004249]);

        $missing = [];
        if (! $hasTotalChol) {
            $missing[] = 'Total cholesterol';
        }
        if (! $hasHdl) {
            $missing[] = 'HDL cholesterol';
        }
        if (! $hasSbp) {
            $missing[] = 'Systolic blood pressure';
        }

        $labsPresent = 3 - count($missing);
        $completeness = $labsPresent / 3;
        $confidence = $completeness * 0.9;

        if ($labsPresent === 0) {
            return [
                'score' => null,
                'tier' => 'uncomputable',
                'confidence' => 0.0,
                'completeness' => 0.0,
                'missing' => $missing,
            ];
        }

        // Convert mg/dL to mmol/L for cholesterol values (OMOP stores in mg/dL)
        $totalCholMmol = $hasTotalChol ? $measurements[3027114] / 38.67 : null;
        $hdlMmol = $hasHdl ? $measurements[3007070] / 38.67 : null;
        $sbp = $hasSbp ? $measurements[3004249] : null;

        $points = 0.0;

        // Age points — risk increases substantially with age
        $points += match (true) {
            $age < 45 => 0,
            $age < 50 => 1,
            $age < 55 => 2,
            $age < 60 => 3,
            $age < 65 => 4,
            default => 5,
        };

        // Sex adjustment — males have higher baseline risk
        if ($isMale) {
            $points += 1;
        }

        // Total cholesterol (mmol/L)
        if ($totalCholMmol !== null) {
            $points += match (true) {
                $totalCholMmol < 4.0 => -1,
                $totalCholMmol < 5.0 => 0,
                $totalCholMmol < 6.0 => 1,
                $totalCholMmol < 7.0 => 2,
                default => 3,
            };
        }

        // HDL cholesterol (mmol/L) — protective
        if ($hdlMmol !== null) {
            $points += match (true) {
                $hdlMmol >= 1.6 => -2,
                $hdlMmol >= 1.2 => -1,
                $hdlMmol >= 0.8 => 0,
                default => 1,
            };
        }

        // SBP
        if ($sbp !== null) {
            $points += match (true) {
                $sbp < 120 => -1,
                $sbp < 140 => 0,
                $sbp < 160 => 1,
                $sbp < 180 => 2,
                default => 3,
            };
        }

        // Approximate risk % from points (simplified mapping)
        $riskPercent = max(0, round($points, 1));

        // Determine tier
        $tier = 'low';
        foreach ($this->riskTiers() as $tierName => $bounds) {
            $lower = $bounds[0];
            $upper = $bounds[1];
            if ($riskPercent >= $lower && ($upper === null || $riskPercent < $upper)) {
                $tier = $tierName;
                break;
            }
        }

        return [
            'score' => $riskPercent,
            'tier' => $tier,
            'confidence' => $confidence,
            'completeness' => $completeness,
            'missing' => $missing,
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor', 'measurement'];
    }
}
