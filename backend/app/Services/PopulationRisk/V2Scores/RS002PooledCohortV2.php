<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS002 v2 – Pooled Cohort Equations (ACC/AHA 10-year ASCVD risk)
 *
 * Simplified point-based approximation of the ACC/AHA Pooled Cohort Equations.
 * Race-specific coefficients omitted (not reliably coded in OMOP CDM);
 * combined coefficients used instead.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS002PooledCohortV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP gender_concept_id for male. */
    private const MALE = 8507;

    public function scoreId(): string
    {
        return 'RS002';
    }

    public function scoreName(): string
    {
        return 'Pooled Cohort Equations (10-year ASCVD)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Simplified ACC/AHA Pooled Cohort Equations for 10-year ASCVD risk. '
            .'Uses total cholesterol, HDL, systolic blood pressure, diabetes, and '
            .'hypertension treatment status. Race omitted (not reliably coded). '
            .'Tiers: low (<5%), intermediate (5-9%), high (10-19%), very high (20%+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Adults aged 40–79 years';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'age_restricted',
            'min_age' => 40,
            'max_age' => 79,
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 1],
            ['label' => 'Hypertensive disorder (treated HTN proxy)', 'ancestor_concept_id' => 316866, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Total cholesterol', 'concept_id' => 3027114, 'unit' => 'mg/dL'],
            ['label' => 'HDL cholesterol', 'concept_id' => 3007070, 'unit' => 'mg/dL'],
            ['label' => 'Systolic blood pressure', 'concept_id' => 3004249, 'unit' => 'mmHg'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 5],
            'intermediate' => [5, 10],
            'high' => [10, 20],
            'very_high' => [20, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $age = $patientData['age'];
        $isMale = $patientData['gender_concept_id'] === self::MALE;
        $conditions = array_flip($patientData['conditions']);
        $measurements = $patientData['measurements'] ?? [];

        $hasDiabetes = isset($conditions[201820]);
        $hasTreatedHtn = isset($conditions[316866]);

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

        $totalChol = $measurements[3027114] ?? null;
        $hdl = $measurements[3007070] ?? null;
        $sbp = $measurements[3004249] ?? null;

        // Simplified point-based approximation
        $points = 0.0;

        // Age contribution: age/10 as base
        $points += $age / 10;

        // Total cholesterol points
        if ($totalChol !== null) {
            $points += match (true) {
                $totalChol < 160 => -3,
                $totalChol < 200 => 0,
                $totalChol < 240 => 1,
                $totalChol < 280 => 2,
                default => 3,
            };
        }

        // HDL points (protective)
        if ($hdl !== null) {
            $points += match (true) {
                $hdl >= 60 => -2,
                $hdl >= 50 => -1,
                $hdl >= 40 => 0,
                default => 2,
            };
        }

        // SBP points — differ based on treatment status
        if ($sbp !== null) {
            if ($hasTreatedHtn) {
                $points += match (true) {
                    $sbp < 120 => 0,
                    $sbp < 130 => 1,
                    $sbp < 140 => 2,
                    $sbp < 160 => 3,
                    default => 4,
                };
            } else {
                $points += match (true) {
                    $sbp < 120 => -1,
                    $sbp < 130 => 0,
                    $sbp < 140 => 1,
                    $sbp < 160 => 2,
                    default => 3,
                };
            }
        }

        // Diabetes
        if ($hasDiabetes) {
            $points += $isMale ? 3 : 4;
        }

        // Clamp to reasonable % range
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
