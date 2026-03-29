<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS019 v2 – CHADS₂ Score
 *
 * Original stroke risk score for atrial fibrillation (Gage 2001).
 * Superseded by CHA₂DS₂-VASc but still widely used.
 * Four condition-based predictors + age ≥75 modifier.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS019CHADS2V2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS019';
    }

    public function scoreName(): string
    {
        return 'CHADS₂ Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Original stroke risk score for atrial fibrillation (Gage 2001). '
            .'Four condition predictors + age ≥75 modifier. Max score: 6. '
            .'Tiers: low (0-1), intermediate (2-3), high (4+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with atrial fibrillation — stroke risk assessment';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [313217],
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 1],
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => 316866, 'weight' => 1],
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 1],
            ['label' => 'Cerebrovascular disease (Stroke/TIA)', 'ancestor_concept_id' => 381591, 'weight' => 2],
        ];
    }

    public function measurementRequirements(): array
    {
        return [];
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
        $conditions = $patientData['conditions'];
        $conditionSet = array_flip($conditions);
        $age = $patientData['age'];

        $score = 0;

        // Sum condition weights
        foreach ($this->conditionGroups() as $group) {
            if (isset($conditionSet[$group['ancestor_concept_id']])) {
                $score += $group['weight'];
            }
        }

        // Age modifier: ≥75 = +1
        if ($age >= 75) {
            $score += 1;
        }

        // Cap at 6
        $score = min($score, 6);

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
            'confidence' => 0.8,
            'completeness' => 1.0,
            'missing' => [],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }
}
