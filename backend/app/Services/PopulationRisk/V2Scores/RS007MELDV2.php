<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS007 v2 – MELD Score (Model for End-stage Liver Disease)
 *
 * Predicts 3-month mortality in end-stage liver disease and prioritizes
 * organ allocation for liver transplantation. Uses bilirubin, INR, and
 * creatinine with logarithmic scaling.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS007MELDV2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS007';
    }

    public function scoreName(): string
    {
        return 'MELD Score';
    }

    public function category(): string
    {
        return 'Hepatic';
    }

    public function description(): string
    {
        return 'Model for End-stage Liver Disease score predicting 3-month mortality. '
            .'Uses bilirubin, INR, and creatinine with logarithmic scaling. '
            .'Values floored at 1.0; creatinine capped at 4.0. '
            .'Tiers: low (<10), intermediate (10-19), high (20-29), very high (30+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with chronic liver disease';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [4212540], // Chronic liver disease
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Chronic liver disease', 'ancestor_concept_id' => 4212540, 'weight' => 0],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Bilirubin total', 'concept_id' => 3024128, 'unit' => 'mg/dL'],
            ['label' => 'INR', 'concept_id' => 3022217, 'unit' => 'ratio'],
            ['label' => 'Creatinine', 'concept_id' => 3016723, 'unit' => 'mg/dL'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 10],
            'intermediate' => [10, 20],
            'high' => [20, 30],
            'very_high' => [30, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];

        $hasBili = isset($measurements[3024128]);
        $hasInr = isset($measurements[3022217]);
        $hasCr = isset($measurements[3016723]);

        $missing = [];
        if (! $hasBili) {
            $missing[] = 'Bilirubin total';
        }
        if (! $hasInr) {
            $missing[] = 'INR';
        }
        if (! $hasCr) {
            $missing[] = 'Creatinine';
        }

        $labsPresent = 3 - count($missing);
        $completeness = $labsPresent / 3;
        $confidence = $completeness * 0.9;

        // MELD requires all 3 labs for a valid calculation
        if ($labsPresent === 0) {
            return [
                'score' => null,
                'tier' => 'uncomputable',
                'confidence' => 0.0,
                'completeness' => 0.0,
                'missing' => $missing,
            ];
        }

        // Apply floors and caps per MELD specification
        $bilirubin = $hasBili ? max($measurements[3024128], 1.0) : 1.0;
        $inr = $hasInr ? max($measurements[3022217], 1.0) : 1.0;
        $creatinine = $hasCr ? min(max($measurements[3016723], 1.0), 4.0) : 1.0;

        // MELD = 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43
        $meld = 3.78 * log($bilirubin)
            + 11.2 * log($inr)
            + 9.57 * log($creatinine)
            + 6.43;

        $score = (float) round($meld);

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
            'score' => $score,
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
