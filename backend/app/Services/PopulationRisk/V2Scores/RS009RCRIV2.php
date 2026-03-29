<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS009 v2 – Revised Cardiac Risk Index (Lee Index)
 *
 * Perioperative cardiac risk prediction for non-cardiac surgery.
 * Six clinical predictors; high-risk surgery type cannot be determined
 * from CDM condition data alone — confidence reduced accordingly.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS009RCRIV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS009';
    }

    public function scoreName(): string
    {
        return 'Revised Cardiac Risk Index (Lee Index)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Perioperative cardiac risk for non-cardiac surgery (Lee 1999). '
            .'Five condition-based predictors scored; surgery type component omitted '
            .'(not determinable from CDM). Confidence: 0.7. '
            .'Tiers: low (0), intermediate (1), high (2), very high (3+).';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — pre-operative cardiac risk assessment';
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
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 1],
            ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 1],
            ['label' => 'Diabetes mellitus (insulin-dependent)', 'ancestor_concept_id' => 201820, 'weight' => 1],
            ['label' => 'Chronic kidney disease (creatinine >2)', 'ancestor_concept_id' => 46271022, 'weight' => 1],
            ['label' => 'Ischemic heart disease (myocardial infarction)', 'ancestor_concept_id' => 4329847, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 1],
            'intermediate' => [1, 2],
            'high' => [2, 3],
            'very_high' => [3, null],
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
            'confidence' => 0.7, // Missing high-risk surgery type component
            'completeness' => 1.0,
            'missing' => ['High-risk surgery type'],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }
}
