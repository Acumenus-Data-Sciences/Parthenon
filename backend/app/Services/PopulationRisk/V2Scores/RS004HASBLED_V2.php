<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS004 v2 – HAS-BLED Score
 *
 * Bleeding risk assessment in anticoagulated patients (typically atrial fibrillation).
 * Conditions-only approximation — INR lability, alcohol/drug use components
 * cannot be reliably determined from CDM conditions alone.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS004HASBLED_V2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS004';
    }

    public function scoreName(): string
    {
        return 'HAS-BLED Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Bleeding risk in anticoagulated patients. Conditions-only approximation — '
            .'INR lability, alcohol, and drug components are unavailable from CDM conditions. '
            .'Confidence reduced to 0.6 accordingly. '
            .'Tiers: low (0-1), intermediate (2), high (3+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with atrial fibrillation on anticoagulation — bleeding risk assessment';
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
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => 316866, 'weight' => 1],
            ['label' => 'Renal impairment', 'ancestor_concept_id' => 4030518, 'weight' => 1],
            ['label' => 'Chronic liver disease', 'ancestor_concept_id' => 4212540, 'weight' => 1],
            ['label' => 'Cerebrovascular disease (Stroke)', 'ancestor_concept_id' => 381591, 'weight' => 1],
            ['label' => 'Prior major bleeding', 'ancestor_concept_id' => 437312, 'weight' => 1],
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
            'intermediate' => [2, 3],
            'high' => [3, null],
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

        // Age modifier: >65 = +1
        if ($age > 65) {
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
            'confidence' => 0.6, // Missing INR lability, alcohol, drug components
            'completeness' => 1.0,
            'missing' => ['INR lability', 'Alcohol use', 'Drug use'],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }
}
