<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS013 v2 – FIB-4 Index (Liver fibrosis staging)
 *
 * Non-invasive screening tool for hepatic fibrosis using age, AST,
 * ALT, and platelet count. FIB-4 = (Age × AST) / (Platelet × √ALT).
 *
 * Three tiers only: low (<1.3 = unlikely fibrosis), intermediate
 * (1.3–2.67 = indeterminate), high (>2.67 = likely advanced fibrosis).
 *
 * All concept_id values verified against vocab.concept 2026-03-29.
 */
class RS013FIB4V2 implements PopulationRiskScoreV2Interface
{
    public function scoreId(): string
    {
        return 'RS013';
    }

    public function scoreName(): string
    {
        return 'FIB-4 Index';
    }

    public function category(): string
    {
        return 'Hepatic';
    }

    public function description(): string
    {
        return 'Non-invasive liver fibrosis screening index. '
            .'FIB-4 = (Age × AST) / (Platelet × √ALT). '
            .'Requires all three labs for computation. '
            .'Tiers: low (<1.3, unlikely fibrosis), intermediate (1.3–2.67, indeterminate), '
            .'high (≥2.67, likely advanced fibrosis).';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — universal fibrosis screening tool';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'universal',
        ];
    }

    public function conditionGroups(): array
    {
        return [];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'AST', 'concept_id' => 3013721, 'unit' => 'U/L'],
            ['label' => 'ALT', 'concept_id' => 3006923, 'unit' => 'U/L'],
            ['label' => 'Platelet count', 'concept_id' => 3024929, 'unit' => '10^9/L'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 1.3],
            'intermediate' => [1.3, 2.67],
            'high' => [2.67, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $age = $patientData['age'];
        $measurements = $patientData['measurements'] ?? [];

        $hasAst = isset($measurements[3013721]);
        $hasAlt = isset($measurements[3006923]);
        $hasPlatelets = isset($measurements[3024929]);

        $missing = [];
        if (! $hasAst) {
            $missing[] = 'AST';
        }
        if (! $hasAlt) {
            $missing[] = 'ALT';
        }
        if (! $hasPlatelets) {
            $missing[] = 'Platelet count';
        }

        $labsPresent = 3 - count($missing);
        $completeness = $labsPresent / 3;
        $confidence = $completeness * 0.9;

        // FIB-4 requires all 3 labs — formula is not meaningful with missing values
        if ($labsPresent < 3) {
            return [
                'score' => null,
                'tier' => 'uncomputable',
                'confidence' => $confidence,
                'completeness' => $completeness,
                'missing' => $missing,
            ];
        }

        $ast = $measurements[3013721];
        $alt = $measurements[3006923];
        $platelets = $measurements[3024929];

        // Guard against division by zero and invalid inputs
        if ($platelets <= 0 || $alt <= 0) {
            return [
                'score' => null,
                'tier' => 'uncomputable',
                'confidence' => 0.0,
                'completeness' => $completeness,
                'missing' => ['Valid lab values (platelet or ALT ≤ 0)'],
            ];
        }

        // FIB-4 = (Age × AST) / (Platelet × √ALT)
        $fib4 = ($age * $ast) / ($platelets * sqrt($alt));
        $score = round($fib4, 2);

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
        return ['person', 'measurement'];
    }
}
