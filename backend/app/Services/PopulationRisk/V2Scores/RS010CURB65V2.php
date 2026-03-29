<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS010 v2 – CURB-65 (Community-Acquired Pneumonia Severity)
 *
 * Predicts mortality risk in community-acquired pneumonia using:
 * C = Confusion (cerebrovascular/dementia proxy), U = BUN > 20 mg/dL,
 * R = Respiratory rate ≥ 30, B = Blood pressure (SBP < 90 or DBP ≤ 60),
 * 65 = Age ≥ 65. Score 0-5.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS010CURB65V2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const BUN = 3013682;        // Urea nitrogen [Mass/volume] in Serum or Plasma

    private const SBP = 3004249;        // Systolic blood pressure

    private const DBP = 3012888;        // Diastolic blood pressure

    private const RESP_RATE = 3024171;  // Respiratory rate

    /** Condition ancestors for confusion proxy */
    private const CEREBROVASCULAR = 381591;

    private const DEMENTIA = 4182210;

    public function scoreId(): string
    {
        return 'RS010';
    }

    public function scoreName(): string
    {
        return 'CURB-65';
    }

    public function category(): string
    {
        return 'Pulmonary';
    }

    public function description(): string
    {
        return 'Predicts 30-day mortality in community-acquired pneumonia. '
            .'C=Confusion, U=BUN>20, R=RR≥30, B=SBP<90 or DBP≤60, 65=Age≥65. '
            .'Tiers: low (0-1), intermediate (2), high (3-5).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with pneumonia';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [255848], // Pneumonia
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Pneumonia', 'ancestor_concept_id' => 255848, 'weight' => 0],
            ['label' => 'Cerebrovascular disease (confusion proxy)', 'ancestor_concept_id' => self::CEREBROVASCULAR, 'weight' => 1],
            ['label' => 'Dementia (confusion proxy)', 'ancestor_concept_id' => self::DEMENTIA, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'BUN (Urea nitrogen)', 'concept_id' => self::BUN, 'unit' => 'mg/dL'],
            ['label' => 'Systolic blood pressure', 'concept_id' => self::SBP, 'unit' => 'mmHg'],
            ['label' => 'Diastolic blood pressure', 'concept_id' => self::DBP, 'unit' => 'mmHg'],
            ['label' => 'Respiratory rate', 'concept_id' => self::RESP_RATE, 'unit' => 'breaths/min'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 2],
            'intermediate' => [2, 3],
            'high' => [3, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);
        $age = $patientData['age'] ?? 0;

        $hasBun = isset($measurements[self::BUN]);
        $hasSbp = isset($measurements[self::SBP]);
        $hasDbp = isset($measurements[self::DBP]);
        $hasRr = isset($measurements[self::RESP_RATE]);

        $missing = [];
        if (! $hasBun) {
            $missing[] = 'BUN (Urea nitrogen)';
        }
        if (! $hasSbp && ! $hasDbp) {
            $missing[] = 'Blood pressure (SBP/DBP)';
        }
        if (! $hasRr) {
            $missing[] = 'Respiratory rate';
        }

        $score = 0;

        // C: Confusion — cerebrovascular disease or dementia as proxy
        $hasConfusion = isset($conditions[self::CEREBROVASCULAR]) || isset($conditions[self::DEMENTIA]);
        if ($hasConfusion) {
            $score += 1;
        }

        // U: BUN > 20 mg/dL
        if ($hasBun && $measurements[self::BUN] > 20.0) {
            $score += 1;
        }

        // R: Respiratory rate ≥ 30
        if ($hasRr && $measurements[self::RESP_RATE] >= 30.0) {
            $score += 1;
        }

        // B: SBP < 90 or DBP ≤ 60
        $bpMet = false;
        if ($hasSbp && $measurements[self::SBP] < 90.0) {
            $bpMet = true;
        }
        if ($hasDbp && $measurements[self::DBP] <= 60.0) {
            $bpMet = true;
        }
        if ($bpMet) {
            $score += 1;
        }

        // 65: Age ≥ 65
        if ($age >= 65) {
            $score += 1;
        }

        // Confidence: 0.5 base + fraction of 3 key measurements (BUN, RR, BP) * 0.4
        $measPresent = ($hasBun ? 1 : 0) + ($hasRr ? 1 : 0) + (($hasSbp || $hasDbp) ? 1 : 0);
        $completeness = $measPresent / 3;
        $confidence = 0.5 + ($completeness * 0.4);

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
            'confidence' => round($confidence, 2),
            'completeness' => round($completeness, 2),
            'missing' => $missing,
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor', 'measurement'];
    }
}
