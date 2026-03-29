<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS020 v2 – Multimorbidity Burden Index
 *
 * Simple count of chronic disease categories present.
 * Each category contributes 1 point regardless of severity.
 * Useful for identifying patients with high disease burden
 * who may benefit from integrated care approaches.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS020MultimorbidityV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS020';
    }

    public function scoreName(): string
    {
        return 'Multimorbidity Burden Index';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function description(): string
    {
        return 'Count of chronic disease categories present. '
            .'15 categories, each contributing 1 point. '
            .'Higher counts indicate greater multimorbidity burden. '
            .'Tiers: low (0-2), intermediate (3-4), high (5-7), very high (8+).';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — multimorbidity burden assessment';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'universal',
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Heart failure', 'ancestor_concept_id' => 316139, 'weight' => 1],
            ['label' => 'Myocardial infarction', 'ancestor_concept_id' => 4329847, 'weight' => 1],
            ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 1],
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 1],
            ['label' => 'COPD', 'ancestor_concept_id' => 255573, 'weight' => 1],
            ['label' => 'Chronic kidney disease', 'ancestor_concept_id' => 46271022, 'weight' => 1],
            ['label' => 'Chronic liver disease', 'ancestor_concept_id' => 4212540, 'weight' => 1],
            ['label' => 'Malignant neoplastic disease', 'ancestor_concept_id' => 443392, 'weight' => 1],
            ['label' => 'Dementia', 'ancestor_concept_id' => 4182210, 'weight' => 1],
            ['label' => 'Depressive disorder', 'ancestor_concept_id' => 440383, 'weight' => 1],
            ['label' => 'Rheumatoid arthritis', 'ancestor_concept_id' => 80809, 'weight' => 1],
            ['label' => 'Obesity', 'ancestor_concept_id' => 433736, 'weight' => 1],
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => 316866, 'weight' => 1],
            ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 1],
            ['label' => 'Sleep apnea', 'ancestor_concept_id' => 313459, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 3],
            'intermediate' => [3, 5],
            'high' => [5, 8],
            'very_high' => [8, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $conditions = $patientData['conditions'];
        $conditionSet = array_flip($conditions);

        $score = 0;

        foreach ($this->conditionGroups() as $group) {
            if (isset($conditionSet[$group['ancestor_concept_id']])) {
                $score += $group['weight'];
            }
        }

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
