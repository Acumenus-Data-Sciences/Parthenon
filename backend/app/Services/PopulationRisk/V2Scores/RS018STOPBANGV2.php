<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS018 v2 – STOP-BANG Questionnaire (CDM approximation)
 *
 * Obstructive sleep apnea screening tool. The full STOP-BANG includes
 * 8 items (Snoring, Tiredness, Observed apneas, Pressure, BMI, Age, Neck, Gender).
 * Only 3 condition-based items + age + sex are available from CDM;
 * snoring, tiredness, and neck circumference are questionnaire items not in CDM.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS018STOPBANGV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS018';
    }

    public function scoreName(): string
    {
        return 'STOP-BANG Score';
    }

    public function category(): string
    {
        return 'Respiratory';
    }

    public function description(): string
    {
        return 'Obstructive sleep apnea screening (CDM approximation). '
            .'3 condition-based items + age >50 + male sex. '
            .'Missing snoring, tiredness, neck circumference (questionnaire items). '
            .'Confidence: 0.5. Tiers: low (0-2), intermediate (3-4), high (5+).';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — obstructive sleep apnea screening';
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
            ['label' => 'Sleep apnea (observed apneas)', 'ancestor_concept_id' => 313459, 'weight' => 1],
            ['label' => 'Hypertensive disorder (pressure)', 'ancestor_concept_id' => 316866, 'weight' => 1],
            ['label' => 'Obesity (BMI >35 proxy)', 'ancestor_concept_id' => 433736, 'weight' => 1],
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
            'high' => [5, null],
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

        // Age modifier: >50 = +1
        if ($age > 50) {
            $score += 1;
        }

        // Male sex modifier: +1
        if ($genderConceptId === 8507) {
            $score += 1;
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
            'confidence' => 0.5, // Missing snoring, tiredness, neck circumference
            'completeness' => 1.0,
            'missing' => ['Snoring', 'Tiredness', 'Neck circumference'],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }
}
