<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS017 v2 – GRACE Score (Global Registry of Acute Coronary Events)
 *
 * Predicts in-hospital mortality in acute coronary syndrome using age,
 * heart rate, systolic blood pressure, creatinine, and clinical proxies
 * for Killip class (CHF) and ST deviation (cerebrovascular disease).
 *
 * Cardiac arrest at admission not detectable from CDM — omitted.
 * Confidence capped at 0.8 due to missing ECG and arrest data.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS017GRACEV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const HEART_RATE = 3027018;

    private const SBP = 3004249;

    private const CREATININE = 3016723;

    /** Condition ancestors */
    private const MI = 4329847;

    private const CHF = 319835;

    private const CEREBROVASCULAR = 381591;

    public function scoreId(): string
    {
        return 'RS017';
    }

    public function scoreName(): string
    {
        return 'GRACE Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Predicts in-hospital mortality in acute coronary syndrome. '
            .'Uses age, heart rate, systolic BP, creatinine, CHF (Killip proxy), '
            .'and cerebrovascular disease (ST deviation proxy). '
            .'Cardiac arrest not detectable from CDM. '
            .'Tiers: low (<109), intermediate (109-139), high (140+).';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with acute coronary syndrome / myocardial infarction';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'condition_specific',
            'required_condition_ancestors' => [self::MI],
        ];
    }

    public function conditionGroups(): array
    {
        return [
            ['label' => 'Myocardial infarction / ACS', 'ancestor_concept_id' => self::MI, 'weight' => 0],
            ['label' => 'Congestive heart failure (Killip class proxy)', 'ancestor_concept_id' => self::CHF, 'weight' => 21],
            ['label' => 'Cerebrovascular disease (ST deviation proxy)', 'ancestor_concept_id' => self::CEREBROVASCULAR, 'weight' => 30],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Heart rate', 'concept_id' => self::HEART_RATE, 'unit' => 'bpm'],
            ['label' => 'Systolic blood pressure', 'concept_id' => self::SBP, 'unit' => 'mmHg'],
            ['label' => 'Creatinine', 'concept_id' => self::CREATININE, 'unit' => 'mg/dL'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [PHP_INT_MIN, 109],
            'intermediate' => [109, 140],
            'high' => [140, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);
        $age = $patientData['age'] ?? 0;

        $hasHr = isset($measurements[self::HEART_RATE]);
        $hasSbp = isset($measurements[self::SBP]);
        $hasCr = isset($measurements[self::CREATININE]);

        $missing = [];
        if (! $hasHr) {
            $missing[] = 'Heart rate';
        }
        if (! $hasSbp) {
            $missing[] = 'Systolic blood pressure';
        }
        if (! $hasCr) {
            $missing[] = 'Creatinine';
        }

        $measPresent = 3 - count($missing);

        $score = 0;

        // Age points
        $score += $this->agePoints($age);

        // Heart rate points
        if ($hasHr) {
            $score += $this->heartRatePoints($measurements[self::HEART_RATE]);
        }

        // Systolic BP points (inverse — lower BP = more points)
        if ($hasSbp) {
            $score += $this->sbpPoints($measurements[self::SBP]);
        }

        // Creatinine points
        if ($hasCr) {
            $score += $this->creatininePoints($measurements[self::CREATININE]);
        }

        // CHF (Killip class II+ proxy): +21
        if (isset($conditions[self::CHF])) {
            $score += 21;
        }

        // Cerebrovascular disease (ST deviation proxy): +30
        if (isset($conditions[self::CEREBROVASCULAR])) {
            $score += 30;
        }

        // Confidence: 0.4 base + fraction of 3 measurements * 0.4 (max 0.8)
        $completeness = $measPresent / 3;
        $confidence = 0.4 + ($completeness * 0.4);

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
            'confidence' => round($confidence, 2),
            'completeness' => round($completeness, 2),
            'missing' => $missing,
        ];
    }

    /**
     * GRACE age-based points.
     */
    private function agePoints(int $age): int
    {
        if ($age <= 40) {
            return 0;
        }
        if ($age <= 50) {
            return 18;
        }
        if ($age <= 60) {
            return 36;
        }
        if ($age <= 70) {
            return 55;
        }
        if ($age <= 80) {
            return 73;
        }
        if ($age <= 90) {
            return 91;
        }

        return 100;
    }

    /**
     * GRACE heart rate points.
     */
    private function heartRatePoints(float $hr): int
    {
        if ($hr < 70) {
            return 0;
        }
        if ($hr < 90) {
            return 7;
        }
        if ($hr < 110) {
            return 13;
        }
        if ($hr < 150) {
            return 23;
        }
        if ($hr < 200) {
            return 36;
        }

        return 46;
    }

    /**
     * GRACE systolic BP points (inverse relationship).
     */
    private function sbpPoints(float $sbp): int
    {
        if ($sbp < 80) {
            return 53;
        }
        if ($sbp < 100) {
            return 43;
        }
        if ($sbp < 120) {
            return 34;
        }
        if ($sbp < 140) {
            return 24;
        }
        if ($sbp < 160) {
            return 14;
        }
        if ($sbp < 200) {
            return 10;
        }

        return 0;
    }

    /**
     * GRACE creatinine points (mg/dL).
     */
    private function creatininePoints(float $cr): int
    {
        if ($cr < 0.39) {
            return 2;
        }
        if ($cr < 0.80) {
            return 5;
        }
        if ($cr < 1.20) {
            return 8;
        }
        if ($cr < 1.60) {
            return 11;
        }
        if ($cr < 2.00) {
            return 14;
        }
        if ($cr < 4.00) {
            return 23;
        }

        return 31;
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor', 'measurement'];
    }
}
