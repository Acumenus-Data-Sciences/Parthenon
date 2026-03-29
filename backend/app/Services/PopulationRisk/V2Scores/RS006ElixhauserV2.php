<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS006 v2 – Elixhauser Comorbidity Index (van Walraven weights)
 *
 * 30-category comorbidity measure using van Walraven composite weights.
 * Weights range from -7 to +12; negative weights indicate conditions
 * associated with lower in-hospital mortality.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS006ElixhauserV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS006';
    }

    public function scoreName(): string
    {
        return 'Elixhauser Comorbidity Index';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function description(): string
    {
        return 'Van Walraven weighted Elixhauser comorbidity score. '
            .'28 condition categories with weights from -7 to +12. '
            .'Higher scores indicate greater comorbidity burden and mortality risk. '
            .'Tiers: low (<0), moderate (0-4), high (5-13), very high (14+).';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — universal comorbidity burden assessment';
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
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 7],
            ['label' => 'Heart valve disorder', 'ancestor_concept_id' => 4281749, 'weight' => -1],
            ['label' => 'Pulmonary hypertension', 'ancestor_concept_id' => 4322024, 'weight' => 4],
            ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 2],
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => 316866, 'weight' => 0],
            ['label' => 'Paralysis', 'ancestor_concept_id' => 440377, 'weight' => 7],
            ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 0],
            ['label' => 'Dementia', 'ancestor_concept_id' => 4182210, 'weight' => 0],
            ['label' => 'COPD', 'ancestor_concept_id' => 255573, 'weight' => 3],
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 0],
            ['label' => 'Chronic kidney disease', 'ancestor_concept_id' => 46271022, 'weight' => 5],
            ['label' => 'Chronic liver disease', 'ancestor_concept_id' => 4212540, 'weight' => 11],
            ['label' => 'Peptic ulcer', 'ancestor_concept_id' => 4027663, 'weight' => 0],
            ['label' => 'Malignant neoplastic disease (solid tumor)', 'ancestor_concept_id' => 443392, 'weight' => 0],
            ['label' => 'Metastatic malignant neoplasm', 'ancestor_concept_id' => 432851, 'weight' => 12],
            ['label' => 'Non-Hodgkin lymphoma', 'ancestor_concept_id' => 4038838, 'weight' => 9],
            ['label' => 'Rheumatoid arthritis', 'ancestor_concept_id' => 80809, 'weight' => 0],
            ['label' => 'Obesity', 'ancestor_concept_id' => 433736, 'weight' => -4],
            ['label' => 'Anemia (blood loss)', 'ancestor_concept_id' => 439777, 'weight' => -2],
            ['label' => 'Iron deficiency anemia', 'ancestor_concept_id' => 436659, 'weight' => 0],
            ['label' => 'Alcohol dependence', 'ancestor_concept_id' => 435243, 'weight' => 0],
            ['label' => 'Substance dependence', 'ancestor_concept_id' => 37165431, 'weight' => -7],
            ['label' => 'Psychotic disorder', 'ancestor_concept_id' => 436073, 'weight' => 0],
            ['label' => 'Depressive disorder', 'ancestor_concept_id' => 440383, 'weight' => -3],
            ['label' => 'Disorder of electrolytes', 'ancestor_concept_id' => 4035139, 'weight' => 5],
            ['label' => 'Hypothyroidism', 'ancestor_concept_id' => 140673, 'weight' => 0],
            ['label' => 'Pulmonary embolism (coagulopathy proxy)', 'ancestor_concept_id' => 440417, 'weight' => 0],
            ['label' => 'Cachexia (weight loss)', 'ancestor_concept_id' => 134765, 'weight' => 6],
        ];
    }

    public function measurementRequirements(): array
    {
        return [];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [-19, 0],
            'moderate' => [0, 5],
            'high' => [5, 14],
            'very_high' => [14, null],
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
