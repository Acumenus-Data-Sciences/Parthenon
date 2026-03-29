<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS008 v2 – Child-Pugh Score (Cirrhosis Severity)
 *
 * Assesses severity of chronic liver disease / cirrhosis using labs
 * (bilirubin, albumin, INR) and clinical proxies (encephalopathy).
 * Ascites cannot be reliably assessed from CDM data alone — confidence
 * is capped at 0.9.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS008ChildPughV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const BILIRUBIN = 3024128;

    private const ALBUMIN = 3024561;

    private const INR = 3022217;

    /** Condition ancestor for encephalopathy proxy */
    private const DEMENTIA_ANCESTOR = 4182210;

    public function scoreId(): string
    {
        return 'RS008';
    }

    public function scoreName(): string
    {
        return 'Child-Pugh Score';
    }

    public function category(): string
    {
        return 'Hepatic';
    }

    public function description(): string
    {
        return 'Assesses severity of chronic liver disease / cirrhosis. '
            .'Uses bilirubin, albumin, INR labs scored 1-3 each, plus encephalopathy proxy. '
            .'Ascites not assessable from CDM — confidence capped at 0.9. '
            .'Tiers: Class A (5-6), Class B (7-9), Class C (10-15).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with cirrhosis of the liver';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [4064161], // Cirrhosis of liver
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Cirrhosis of liver', 'ancestor_concept_id' => 4064161, 'weight' => 0],
            ['label' => 'Encephalopathy (dementia proxy)', 'ancestor_concept_id' => self::DEMENTIA_ANCESTOR, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Bilirubin total', 'concept_id' => self::BILIRUBIN, 'unit' => 'mg/dL'],
            ['label' => 'Albumin', 'concept_id' => self::ALBUMIN, 'unit' => 'g/dL'],
            ['label' => 'INR', 'concept_id' => self::INR, 'unit' => 'ratio'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [5, 7],        // Class A
            'intermediate' => [7, 10], // Class B
            'high' => [10, null],     // Class C
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);

        $hasBili = isset($measurements[self::BILIRUBIN]);
        $hasAlbumin = isset($measurements[self::ALBUMIN]);
        $hasInr = isset($measurements[self::INR]);

        $missing = [];
        if (! $hasBili) {
            $missing[] = 'Bilirubin total';
        }
        if (! $hasAlbumin) {
            $missing[] = 'Albumin';
        }
        if (! $hasInr) {
            $missing[] = 'INR';
        }

        $labsPresent = 3 - count($missing);

        // Cannot compute without any labs
        if ($labsPresent === 0) {
            return [
                'score' => null,
                'tier' => 'uncomputable',
                'confidence' => 0.0,
                'completeness' => 0.0,
                'missing' => $missing,
            ];
        }

        $score = 0;

        // Bilirubin: 1pt ≤2, 2pt 2-3, 3pt >3 mg/dL
        if ($hasBili) {
            $bili = $measurements[self::BILIRUBIN];
            $score += $bili <= 2.0 ? 1 : ($bili <= 3.0 ? 2 : 3);
        } else {
            $score += 1; // Assume best case for missing
        }

        // Albumin: 1pt >3.5, 2pt 2.8-3.5, 3pt <2.8 g/dL
        if ($hasAlbumin) {
            $alb = $measurements[self::ALBUMIN];
            $score += $alb > 3.5 ? 1 : ($alb >= 2.8 ? 2 : 3);
        } else {
            $score += 1;
        }

        // INR: 1pt <1.7, 2pt 1.7-2.2, 3pt >2.2
        if ($hasInr) {
            $inr = $measurements[self::INR];
            $score += $inr < 1.7 ? 1 : ($inr <= 2.2 ? 2 : 3);
        } else {
            $score += 1;
        }

        // Encephalopathy proxy (dementia): +1 if present
        if (isset($conditions[self::DEMENTIA_ANCESTOR])) {
            $score += 1;
        }

        // Confidence: 0.5 base + fraction of 3 labs * 0.4 (max 0.9 — can't assess ascites)
        $completeness = $labsPresent / 3;
        $confidence = 0.5 + ($completeness * 0.4);

        // Determine tier — scores below 5 map to 'low' (well-compensated Class A)
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
            'confidence' => round($confidence, 2),
            'completeness' => round($completeness, 2),
            'missing' => $missing,
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor', 'measurement'];
    }
}
