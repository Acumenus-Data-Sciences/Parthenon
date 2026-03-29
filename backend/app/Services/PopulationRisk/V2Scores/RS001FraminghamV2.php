<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS001 v2 – Framingham Risk Score (10-year cardiovascular risk)
 *
 * Simplified Framingham point-based model using total cholesterol,
 * HDL cholesterol, systolic blood pressure, and diabetes status.
 * Smoking status omitted (observation domain, not reliably coded in CDM).
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS001FraminghamV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP gender_concept_id for male. */
    private const MALE = 8507;

    public function scoreId(): string
    {
        return 'RS001';
    }

    public function scoreName(): string
    {
        return 'Framingham Risk Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Simplified Framingham 10-year cardiovascular risk score using total cholesterol, '
            .'HDL cholesterol, systolic blood pressure, and diabetes status. '
            .'Smoking component omitted (not reliably coded in OMOP CDM). '
            .'Tiers: low (<10), intermediate (10-14), high (15-19), very high (20+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Adults aged 30–74 years';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'age_restricted',
            'min_age' => 30,
            'max_age' => 74,
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
            ['label' => 'Total cholesterol', 'concept_id' => 3027114, 'unit' => 'mg/dL'],
            ['label' => 'HDL cholesterol', 'concept_id' => 3007070, 'unit' => 'mg/dL'],
            ['label' => 'Systolic blood pressure', 'concept_id' => 3004249, 'unit' => 'mmHg'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 10],
            'intermediate' => [10, 15],
            'high' => [15, 20],
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

        // If no labs at all, score is uncomputable
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

        $points = $isMale
            ? $this->computeMalePoints($age, $totalChol, $hdl, $sbp, $hasDiabetes)
            : $this->computeFemalePoints($age, $totalChol, $hdl, $sbp, $hasDiabetes);

        // Determine tier
        $tier = 'low';
        foreach ($this->riskTiers() as $tierName => $bounds) {
            $lower = $bounds[0];
            $upper = $bounds[1];
            if ($points >= $lower && ($upper === null || $points < $upper)) {
                $tier = $tierName;
                break;
            }
        }

        return [
            'score' => (float) $points,
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

    private function computeMalePoints(int $age, ?float $totalChol, ?float $hdl, ?float $sbp, bool $diabetes): int
    {
        $points = 0;

        // Age points
        $points += match (true) {
            $age < 35 => 0,
            $age < 40 => 2,
            $age < 45 => 5,
            $age < 50 => 6,
            $age < 55 => 8,
            $age < 60 => 10,
            $age < 65 => 11,
            $age < 70 => 12,
            default => 14,
        };

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

        // HDL points
        if ($hdl !== null) {
            $points += match (true) {
                $hdl >= 60 => -2,
                $hdl >= 50 => -1,
                $hdl >= 40 => 0,
                default => 1,
            };
        }

        // SBP points (untreated)
        if ($sbp !== null) {
            $points += match (true) {
                $sbp < 120 => -2,
                $sbp < 130 => 0,
                $sbp < 140 => 1,
                $sbp < 160 => 2,
                default => 3,
            };
        }

        // Diabetes
        if ($diabetes) {
            $points += 3;
        }

        return $points;
    }

    private function computeFemalePoints(int $age, ?float $totalChol, ?float $hdl, ?float $sbp, bool $diabetes): int
    {
        $points = 0;

        // Age points
        $points += match (true) {
            $age < 35 => -9,
            $age < 40 => -4,
            $age < 45 => 0,
            $age < 50 => 3,
            $age < 55 => 6,
            $age < 60 => 7,
            $age < 65 => 8,
            default => 8,
        };

        // Total cholesterol points
        if ($totalChol !== null) {
            $points += match (true) {
                $totalChol < 160 => -2,
                $totalChol < 200 => 0,
                $totalChol < 240 => 1,
                $totalChol < 280 => 1,
                default => 3,
            };
        }

        // HDL points
        if ($hdl !== null) {
            $points += match (true) {
                $hdl >= 60 => -2,
                $hdl >= 50 => -1,
                $hdl >= 40 => 0,
                default => 1,
            };
        }

        // SBP points
        if ($sbp !== null) {
            $points += match (true) {
                $sbp < 120 => -3,
                $sbp < 130 => 0,
                $sbp < 140 => 1,
                $sbp < 160 => 2,
                default => 3,
            };
        }

        // Diabetes
        if ($diabetes) {
            $points += 4;
        }

        return $points;
    }
}
