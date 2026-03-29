<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS016 v2 – FRAX (Fracture Risk Assessment Tool — Simplified)
 *
 * Simplified approximation of the FRAX 10-year fracture risk score using
 * available CDM data. Full FRAX requires bone mineral density (DXA),
 * parental fracture history, prior fracture, glucocorticoid use, smoking,
 * and alcohol intake — most unavailable from structured CDM data.
 *
 * Uses: age (scaled), sex, BMI, rheumatoid arthritis, alcohol dependence proxy.
 * Confidence is capped at 0.4 due to missing inputs.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS016FRAXV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const BMI = 3038553;

    /** Condition ancestors */
    private const RHEUMATOID_ARTHRITIS = 80809;

    private const ALCOHOL_DEPENDENCE = 435243;

    /** OMOP gender concept IDs */
    private const FEMALE = 8532;

    public function scoreId(): string
    {
        return 'RS016';
    }

    public function scoreName(): string
    {
        return 'FRAX Score (Simplified)';
    }

    public function category(): string
    {
        return 'Musculoskeletal';
    }

    public function description(): string
    {
        return 'Simplified approximation of the FRAX 10-year fracture risk score. '
            .'Uses age (scaled), sex, BMI, rheumatoid arthritis, and alcohol dependence proxy. '
            .'Full FRAX requires bone density, prior fracture, parental fracture, glucocorticoids, '
            .'and smoking — confidence capped at 0.4. '
            .'Tiers: low (0-1), intermediate (2-3), high (4+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients aged 40-90';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'age_restricted',
            'min_age' => 40,
            'max_age' => 90,
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Rheumatoid arthritis', 'ancestor_concept_id' => self::RHEUMATOID_ARTHRITIS, 'weight' => 1],
            ['label' => 'Alcohol dependence (≥3 units/day proxy)', 'ancestor_concept_id' => self::ALCOHOL_DEPENDENCE, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'BMI', 'concept_id' => self::BMI, 'unit' => 'kg/m2'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 2],
            'intermediate' => [2, 4],
            'high' => [4, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);
        $age = $patientData['age'] ?? 0;
        $genderConceptId = $patientData['gender_concept_id'] ?? 0;

        $missing = [];
        $score = 0;

        // Age contribution: scaled by decade (age / 10, floored)
        // e.g., 65 → 6 points would dominate; use age_decade - 4 to normalize for 40+ population
        $ageDecade = (int) floor($age / 10);
        $score += max($ageDecade - 4, 0); // 40s=0, 50s=1, 60s=2, 70s=3, 80s=4, 90=5

        // Sex: female = +1 (higher osteoporosis risk)
        if ($genderConceptId === self::FEMALE) {
            $score += 1;
        }

        // Low BMI: < 20 = +1
        $hasBmi = isset($measurements[self::BMI]);
        if (! $hasBmi) {
            $missing[] = 'BMI';
        } elseif ($measurements[self::BMI] < 20.0) {
            $score += 1;
        }

        // Condition contributions
        if (isset($conditions[self::RHEUMATOID_ARTHRITIS])) {
            $score += 1;
        }
        if (isset($conditions[self::ALCOHOL_DEPENDENCE])) {
            $score += 1;
        }

        // Confidence: 0.4 (many critical FRAX factors missing)
        $completeness = $hasBmi ? 1.0 : 0.0;
        $confidence = 0.4;

        // Determine tier
        $tier = 'low';
        foreach ($this->riskTiers() as $tierName => $bounds) {
            $lower = $bounds[0];
            $upper = $bounds[1];
            if ($score >= $lower && ($upper === null || $score < $upper)) {
                $tier = $tierName;
                break;
            }
        }

        return [
            'score' => (float) $score,
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
