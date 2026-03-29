<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS015 v2 – TIMI Risk Score (ACS / Unstable Angina)
 *
 * Predicts 14-day risk of death, MI, or urgent revascularization in
 * acute coronary syndrome. Uses troponin elevation, age, and comorbid
 * conditions as proxies for the full TIMI criteria (ECG changes, aspirin
 * use, and coronary stenosis data not available from CDM).
 *
 * All concept_id/ancestor_concept_id values verified against vocab.concept 2026-03-29.
 */
class RS015TIMIV2 implements PopulationRiskScoreV2Interface
{
    /** OMOP measurement concept IDs */
    private const TROPONIN = 3021337; // Troponin I cardiac

    /** Condition ancestors */
    private const MI = 4329847;

    private const HYPERTENSION = 316866;

    private const DIABETES = 201820;

    private const CEREBROVASCULAR = 381591;

    private const PVD = 321052;

    private const CHF = 319835;

    public function scoreId(): string
    {
        return 'RS015';
    }

    public function scoreName(): string
    {
        return 'TIMI Risk Score';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function description(): string
    {
        return 'Predicts 14-day mortality and adverse events in ACS / unstable angina. '
            .'Uses troponin, age ≥65, and comorbid conditions (HTN, DM, CVD, PVD, CHF). '
            .'ECG changes, aspirin use, and stenosis data unavailable from CDM. '
            .'Tiers: low (0-2), intermediate (3-4), high (5+).';
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
            ['label' => 'Hypertensive disorder', 'ancestor_concept_id' => self::HYPERTENSION, 'weight' => 1],
            ['label' => 'Diabetes mellitus', 'ancestor_concept_id' => self::DIABETES, 'weight' => 1],
            ['label' => 'Cerebrovascular disease (CAD proxy)', 'ancestor_concept_id' => self::CEREBROVASCULAR, 'weight' => 1],
            ['label' => 'Peripheral vascular disease (CAD proxy)', 'ancestor_concept_id' => self::PVD, 'weight' => 1],
            ['label' => 'Congestive heart failure', 'ancestor_concept_id' => self::CHF, 'weight' => 1],
        ];
    }

    public function measurementRequirements(): array
    {
        return [
            ['label' => 'Troponin I cardiac', 'concept_id' => self::TROPONIN, 'unit' => 'ng/mL'],
        ];
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
        $measurements = $patientData['measurements'] ?? [];
        $conditions = array_flip($patientData['conditions'] ?? []);
        $age = $patientData['age'] ?? 0;

        $missing = [];
        $score = 0;

        // Age ≥ 65 = 1 point
        if ($age >= 65) {
            $score += 1;
        }

        // Troponin elevated (> 0.04 ng/mL) = 1 point
        $hasTroponin = isset($measurements[self::TROPONIN]);
        if (! $hasTroponin) {
            $missing[] = 'Troponin I cardiac';
        } elseif ($measurements[self::TROPONIN] > 0.04) {
            $score += 1;
        }

        // Condition points — don't double-count cerebrovascular + PVD as CAD proxy
        $cadProxyCounted = false;

        if (isset($conditions[self::HYPERTENSION])) {
            $score += 1;
        }
        if (isset($conditions[self::DIABETES])) {
            $score += 1;
        }
        if (isset($conditions[self::CEREBROVASCULAR])) {
            $score += 1;
            $cadProxyCounted = true;
        }
        if (isset($conditions[self::PVD]) && ! $cadProxyCounted) {
            $score += 1;
        }
        if (isset($conditions[self::CHF])) {
            $score += 1;
        }

        // Confidence: 0.5 — missing ECG data, aspirin use, stenosis data
        $completeness = $hasTroponin ? 1.0 : 0.0;
        $confidence = 0.5;

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
