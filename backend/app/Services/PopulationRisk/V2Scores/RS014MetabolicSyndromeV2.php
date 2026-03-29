<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS014 v2 – Metabolic Syndrome Score (ATP III Criteria Count)
 *
 * Counts how many of the 5 ATP III criteria for metabolic syndrome are met,
 * using either lab values or condition diagnoses as evidence. ≥3 criteria
 * defines metabolic syndrome.
 *
 * Gender-aware: HDL and waist circumference thresholds differ by sex.
 * OMOP gender_concept_id: 8507 = male, 8532 = female.
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS014MetabolicSyndromeV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const TRIGLYCERIDES = 3022192;

    private const HDL = 3007070;

    private const SBP = 3004249;

    private const DBP = 3012888;

    private const GLUCOSE = 3004501;

    private const WAIST = 4172830;

    private const BMI = 3038553;

    /** Condition ancestors */
    private const DIABETES = 201820;

    private const HYPERTENSION = 316866;

    private const OBESITY = 433736;

    /** OMOP gender concept IDs */
    private const MALE = 8507;

    public function scoreId(): string
    {
        return 'RS014';
    }

    public function scoreName(): string
    {
        return 'Metabolic Syndrome Score (ATP III)';
    }

    public function category(): string
    {
        return 'Metabolic';
    }

    public function description(): string
    {
        return 'Counts ATP III criteria for metabolic syndrome: triglycerides ≥150, low HDL, '
            .'elevated BP, fasting glucose ≥100, and central obesity. '
            .'Conditions (diabetes, hypertension, obesity) satisfy criteria when labs are absent. '
            .'Tiers: low (0-2), intermediate (3), high (4-5). ≥3 = metabolic syndrome.';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients — universal metabolic risk assessment';
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
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => self::DIABETES, 'weight' => 0],
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => self::HYPERTENSION, 'weight' => 0],
            ['label' => 'Obesity', 'ancestor_concept_id' => self::OBESITY, 'weight' => 0],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Triglycerides', 'concept_id' => self::TRIGLYCERIDES, 'unit' => 'mg/dL'],
            ['label' => 'HDL cholesterol', 'concept_id' => self::HDL, 'unit' => 'mg/dL'],
            ['label' => 'Systolic blood pressure', 'concept_id' => self::SBP, 'unit' => 'mmHg'],
            ['label' => 'Diastolic blood pressure', 'concept_id' => self::DBP, 'unit' => 'mmHg'],
            ['label' => 'Glucose', 'concept_id' => self::GLUCOSE, 'unit' => 'mg/dL'],
            ['label' => 'Waist circumference', 'concept_id' => self::WAIST, 'unit' => 'cm'],
            ['label' => 'BMI', 'concept_id' => self::BMI, 'unit' => 'kg/m2'],
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 3],
            'intermediate' => [3, 4],
            'high' => [4, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);
        $genderConceptId = $patientData['gender_concept_id'] ?? 0;
        $isMale = $genderConceptId === self::MALE;

        $missing = [];
        $criteriaCount = 0;
        $measChecked = 0;

        // 1. Triglycerides ≥ 150 mg/dL
        if (isset($measurements[self::TRIGLYCERIDES])) {
            $measChecked++;
            if ($measurements[self::TRIGLYCERIDES] >= 150.0) {
                $criteriaCount++;
            }
        } else {
            $missing[] = 'Triglycerides';
        }

        // 2. Low HDL: <40 male, <50 female
        if (isset($measurements[self::HDL])) {
            $measChecked++;
            $hdlThreshold = $isMale ? 40.0 : 50.0;
            if ($measurements[self::HDL] < $hdlThreshold) {
                $criteriaCount++;
            }
        } else {
            $missing[] = 'HDL cholesterol';
        }

        // 3. Elevated BP: SBP ≥130 or DBP ≥85 — or hypertension diagnosis
        $bpChecked = false;
        $bpMet = false;
        if (isset($measurements[self::SBP])) {
            $bpChecked = true;
            if ($measurements[self::SBP] >= 130.0) {
                $bpMet = true;
            }
        }
        if (isset($measurements[self::DBP])) {
            $bpChecked = true;
            if ($measurements[self::DBP] >= 85.0) {
                $bpMet = true;
            }
        }
        if ($bpChecked) {
            $measChecked++;
        }
        if ($bpMet || isset($conditions[self::HYPERTENSION])) {
            $criteriaCount++;
        } elseif (! $bpChecked && ! isset($conditions[self::HYPERTENSION])) {
            $missing[] = 'Blood pressure (SBP/DBP)';
        }

        // 4. Fasting glucose ≥ 100 mg/dL — or diabetes diagnosis
        if (isset($measurements[self::GLUCOSE])) {
            $measChecked++;
            if ($measurements[self::GLUCOSE] >= 100.0 || isset($conditions[self::DIABETES])) {
                $criteriaCount++;
            }
        } elseif (isset($conditions[self::DIABETES])) {
            $criteriaCount++;
        } else {
            $missing[] = 'Glucose';
        }

        // 5. Central obesity: waist >102 male / >88 female — or BMI >30 — or obesity diagnosis
        $waistChecked = false;
        $waistMet = false;
        if (isset($measurements[self::WAIST])) {
            $waistChecked = true;
            $measChecked++;
            $waistThreshold = $isMale ? 102.0 : 88.0;
            if ($measurements[self::WAIST] > $waistThreshold) {
                $waistMet = true;
            }
        } elseif (isset($measurements[self::BMI])) {
            $waistChecked = true;
            $measChecked++;
            if ($measurements[self::BMI] > 30.0) {
                $waistMet = true;
            }
        }
        if ($waistMet || isset($conditions[self::OBESITY])) {
            $criteriaCount++;
        } elseif (! $waistChecked && ! isset($conditions[self::OBESITY])) {
            $missing[] = 'Waist circumference / BMI';
        }

        // Confidence: 0.5 + fraction of 5 measurements checked * 0.4
        $completeness = min($measChecked / 5, 1.0);
        $confidence = 0.5 + ($completeness * 0.4);

        $score = (float) $criteriaCount;

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
