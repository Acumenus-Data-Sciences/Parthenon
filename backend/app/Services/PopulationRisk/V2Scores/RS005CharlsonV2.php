<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS005 v2 – Charlson Comorbidity Index (CCI)
 *
 * Weighted comorbidity score predicting 10-year mortality risk.
 * Uses the Quan 2005 SNOMED-adapted coding algorithm applied to OMOP
 * condition_occurrence with concept_ancestor descendant lookups.
 *
 * All ancestor_concept_id values verified against vocab.concept 2026-03-28.
 *
 * Supersession rules:
 *   - Metastatic (6) supersedes any malignancy (2)
 *   - Severe liver / portal hypertension (3) supersedes mild liver / cirrhosis (1)
 *   - Hemiplegia and paraplegia do not double-count (combined as one group)
 */
class RS005CharlsonV2 implements PopulationRiskScoreV2Interface
{
    /** Ancestor concept IDs that supersede others when both are present. */
    private const METASTATIC_ANCESTOR = 432851;

    private const MALIGNANCY_ANCESTOR = 443392;

    private const SEVERE_LIVER_ANCESTOR = 192680;

    private const MILD_LIVER_ANCESTOR = 4064161;

    public function scoreId(): string
    {
        return 'RS005';
    }

    public function scoreName(): string
    {
        return 'Charlson Comorbidity Index (CCI)';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function description(): string
    {
        return 'Weighted comorbidity score (Quan 2005 SNOMED adaptation) predicting 10-year mortality. '
            .'Conditions are weighted 1-6 and summed with supersession rules. '
            .'Tiers: low (0-2), moderate (3-4), high (5-6), very high (7+).';
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
            // Weight 1
            ['label' => 'Myocardial infarction', 'ancestor_concept_id' => 4329847, 'weight' => 1],
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 1],
            ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 1],
            ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 1],
            ['label' => 'Dementia', 'ancestor_concept_id' => 4182210, 'weight' => 1],
            ['label' => 'COPD', 'ancestor_concept_id' => 255573, 'weight' => 1],
            ['label' => 'Rheumatoid arthritis', 'ancestor_concept_id' => 80809, 'weight' => 1],
            ['label' => 'Peptic ulcer', 'ancestor_concept_id' => 4027663, 'weight' => 1],
            ['label' => 'Mild liver disease', 'ancestor_concept_id' => self::MILD_LIVER_ANCESTOR, 'weight' => 1],
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => 201820, 'weight' => 1],
            // Weight 2
            ['label' => 'Hemiplegia', 'ancestor_concept_id' => 374022, 'weight' => 2],
            ['label' => 'Paraplegia', 'ancestor_concept_id' => 192606, 'weight' => 2],
            ['label' => 'Chronic kidney disease', 'ancestor_concept_id' => 46271022, 'weight' => 2],
            ['label' => 'Malignant neoplastic disease', 'ancestor_concept_id' => self::MALIGNANCY_ANCESTOR, 'weight' => 2],
            // Weight 3
            ['label' => 'Severe liver disease', 'ancestor_concept_id' => self::SEVERE_LIVER_ANCESTOR, 'weight' => 3],
            // Weight 6
            ['label' => 'Metastatic malignant neoplasm', 'ancestor_concept_id' => self::METASTATIC_ANCESTOR, 'weight' => 6],
            ['label' => 'HIV/AIDS', 'ancestor_concept_id' => 439727, 'weight' => 6],
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
            'moderate' => [3, 5],
            'high' => [5, 7],
            'very_high' => [7, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $conditions = $patientData['conditions'];
        $conditionSet = array_flip($conditions);

        $score = 0;

        // Track supersession
        $hasMetastatic = isset($conditionSet[self::METASTATIC_ANCESTOR]);
        $hasMalignancy = isset($conditionSet[self::MALIGNANCY_ANCESTOR]);
        $hasSevereLiver = isset($conditionSet[self::SEVERE_LIVER_ANCESTOR]);
        $hasMildLiver = isset($conditionSet[self::MILD_LIVER_ANCESTOR]);
        $hasHemiplegia = isset($conditionSet[374022]);
        $hasParaplegia = isset($conditionSet[192606]);

        foreach ($this->conditionGroups() as $group) {
            $ancestorId = $group['ancestor_concept_id'];
            $weight = $group['weight'];

            if (! isset($conditionSet[$ancestorId])) {
                continue;
            }

            // Supersession: metastatic (6) supersedes malignancy (2)
            if ($ancestorId === self::MALIGNANCY_ANCESTOR && $hasMetastatic) {
                continue;
            }

            // Supersession: severe liver (3) supersedes mild liver (1)
            if ($ancestorId === self::MILD_LIVER_ANCESTOR && $hasSevereLiver) {
                continue;
            }

            // Hemiplegia/paraplegia: don't double-count — take highest weight only once
            if ($ancestorId === 192606 && $hasHemiplegia) {
                // Paraplegia skipped when hemiplegia already counted (same weight)
                continue;
            }

            $score += $weight;
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
            'confidence' => 0.8, // Absent conditions may be truly absent or uncoded
            'completeness' => 1.0, // No labs required — conditions only
            'missing' => [],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }
}
