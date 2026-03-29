<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS003 v2 – CHA₂DS₂-VASc Score
 *
 * Stroke risk stratification in patients with atrial fibrillation.
 * Extends the original CHADS₂ with age and sex modifiers.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS003CHA2DS2VASc_V2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS003';
    }

    public function scoreName(): string
    {
        return 'CHA₂DS₂-VASc Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Stroke risk stratification in atrial fibrillation patients. '
            .'Extends CHADS₂ with age (65-74 = +1, ≥75 = +2) and female sex (+1). '
            .'Conditions-only with demographic modifiers. Max score: 9. '
            .'Tiers: low (0-1), intermediate (2-3), high (4-5), very high (6+).';
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
            ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 1],
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
            'high' => [4, 6],
            'very_high' => [6, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $conditions = $patientData['conditions'];
        $conditionSet = array_flip($conditions);
        $age = $patientData['age'];
        $genderConceptId = $patientData['gender_concept_id'];

        $score = 0;

        // Sum condition weights
        foreach ($this->conditionGroups() as $group) {
            if (isset($conditionSet[$group['ancestor_concept_id']])) {
                $score += $group['weight'];
            }
        }

        // Age modifiers: ≥75 = +2, 65-74 = +1
        if ($age >= 75) {
            $score += 2;
        } elseif ($age >= 65) {
            $score += 1;
        }

        // Female sex modifier: +1
        if ($genderConceptId === 8532) {
            $score += 1;
        }

        // Cap at 9
        $score = min($score, 9);

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
