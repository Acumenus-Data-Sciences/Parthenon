<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS011 v2 – Diabetes Complications Severity Index (DCSI)
 *
 * Composite severity index for diabetes patients combining complication
 * conditions (CKD, CVD, PVD, CHF, MI) with lab-based severity markers
 * (HbA1c, creatinine).
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS011DCSIV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS011';
    }

    public function scoreName(): string
    {
        return 'Diabetes Complications Severity Index';
    }

    public function category(): string
    {
        return 'Endocrine';
    }

    public function description(): string
    {
        return 'Composite severity index for diabetic patients scoring complication burden '
            .'(CKD, cerebrovascular, PVD, heart failure, MI) plus lab severity markers '
            .'(HbA1c ≥9% = poor glycemic control, creatinine >2 = renal severity). '
            .'Tiers: low (0-1), intermediate (2-3), high (4-5), very high (6+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with diabetes mellitus';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [201820], // Diabetes mellitus
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Chronic kidney disease', 'ancestor_concept_id' => 46271022, 'weight' => 1],
            ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 1],
            ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 1],
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 1],
            ['label' => 'Myocardial infarction', 'ancestor_concept_id' => 4329847, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'HbA1c', 'concept_id' => 3004410, 'unit' => '%'],
            ['label' => 'Creatinine', 'concept_id' => 3016723, 'unit' => 'mg/dL'],
        ];
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
        $conditions = array_flip($patientData['conditions']);
        $measurements = $patientData['measurements'] ?? [];

        // Sum condition-based points
        $score = 0;
        foreach ($this->conditionGroups() as $group) {
            if (isset($conditions[$group['ancestor_concept_id']])) {
                $score += $group['weight'];
            }
        }

        // Lab-based severity markers
        $hasHba1c = isset($measurements[3004410]);
        $hasCr = isset($measurements[3016723]);

        $missing = [];
        if (! $hasHba1c) {
            $missing[] = 'HbA1c';
        }
        if (! $hasCr) {
            $missing[] = 'Creatinine';
        }

        $labsPresent = 2 - count($missing);

        // HbA1c >= 9.0% indicates poor glycemic control
        if ($hasHba1c && $measurements[3004410] >= 9.0) {
            $score += 1;
        }

        // Creatinine > 2.0 mg/dL indicates renal severity
        if ($hasCr && $measurements[3016723] > 2.0) {
            $score += 1;
        }

        // Confidence: 0.5 base (conditions alone are meaningful) + 0.25 per lab fraction
        $completeness = $labsPresent / 2;
        $confidence = 0.5 + 0.25 * $completeness;

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
