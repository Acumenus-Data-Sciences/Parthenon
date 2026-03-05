<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS018STOPBANGApnea implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS018';
    }

    public function scoreName(): string
    {
        return 'STOP-BANG Sleep Apnea Risk';
    }

    public function category(): string
    {
        return 'Pulmonary';
    }

    public function eligiblePopulation(): string
    {
        return 'All adult patients (≥18)';
    }

    public function description(): string
    {
        return 'STOP-BANG is an 8-item validated screening questionnaire for obstructive sleep apnea. '
            .'Items: S=Snoring (condition), T=Tired/fatigue (condition), O=Observed apnea (condition), '
            .'P=Pressure/hypertension treated (condition or medication), B=BMI>35 (diagnosis or BMI '
            .'measurement), A=Age>50, N=Neck circumference>40cm (proxied by obesity+male sex), '
            .'G=Gender male. Score 0-8. Confidence is capped at 7/8 = 0.875 because neck circumference '
            .'is never directly measurable from CDM and is always a proxy. BMI measurement may not be '
            .'present for all patients, contributing to the missing_components count.';
    }

    public function requiredComponents(): array
    {
        return [
            'snoring',
            'fatigue',
            'observed_apnea',
            'hypertension',
            'bmi_gt35',
            'age_gt50',
            'neck_circumference_proxy',
            'sex_male',
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

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'measurement', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH adult_patients AS (
    SELECT
        p.person_id,
        p.gender_concept_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 18
),

-- S: Snoring conditions
snoring_flag AS (
    SELECT DISTINCT person_id, 1 AS has_snoring
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4249576, 4056050, 4215512)
),

-- T: Tired — fatigue or hypersomnia conditions
tired_flag AS (
    SELECT DISTINCT person_id, 1 AS has_fatigue
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4226263, 4163735, 438727, 4230448)
),

-- O: Observed apnea
apnea_flag AS (
    SELECT DISTINCT person_id, 1 AS has_apnea
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4173837, 4098304, 40480893, 4215376)
),

-- P: Treated hypertension — diagnosis or antihypertensive medication
htn_diag AS (
    SELECT DISTINCT person_id, 1 AS has_htn
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id = 316866
),

antihtn_med AS (
    SELECT DISTINCT de.person_id, 1 AS on_antihtn
    FROM {cdmSchema}.drug_exposure de
    INNER JOIN {cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    WHERE ca.ancestor_concept_id IN (
        1340128,  -- lisinopril
        1308216,  -- amlodipine
        1353766,  -- atenolol
        974166,   -- hydrochlorothiazide
        1308738   -- losartan
    )
),

-- B: BMI > 35 — morbid obesity diagnosis or BMI measurement > 35
morbid_obesity_diag AS (
    SELECT DISTINCT person_id, 1 AS morbidly_obese
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (433736, 4119134)
),

latest_bmi AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS bmi_value
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3038553
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

stopbang_components AS (
    SELECT
        ap.person_id,
        ap.gender_concept_id,
        ap.age,

        -- S: Snoring
        COALESCE(sn.has_snoring, 0) AS item_s,

        -- T: Tired/fatigue
        COALESCE(ti.has_fatigue, 0) AS item_t,

        -- O: Observed apnea
        COALESCE(oa.has_apnea, 0) AS item_o,

        -- P: Pressure (hypertension treated)
        CASE
            WHEN COALESCE(htn.has_htn, 0) = 1 THEN 1
            WHEN COALESCE(aht.on_antihtn, 0) = 1 THEN 1
            ELSE 0
        END AS item_p,

        -- B: BMI > 35
        CASE
            WHEN COALESCE(mob.morbidly_obese, 0) = 1 THEN 1
            WHEN bmi.bmi_value > 35 THEN 1
            ELSE 0
        END AS item_b,

        -- A: Age > 50
        CASE WHEN ap.age > 50 THEN 1 ELSE 0 END AS item_a,

        -- N: Neck circumference > 40cm proxy (obesity + male)
        CASE
            WHEN ap.gender_concept_id = 8507
              AND COALESCE(mob.morbidly_obese, 0) = 1 THEN 1
            ELSE 0
        END AS item_n,

        -- G: Gender male
        CASE WHEN ap.gender_concept_id = 8507 THEN 1 ELSE 0 END AS item_g,

        -- BMI measurement availability for missing_components
        bmi.bmi_value

    FROM adult_patients ap
    LEFT JOIN snoring_flag sn       ON sn.person_id = ap.person_id
    LEFT JOIN tired_flag ti         ON ti.person_id = ap.person_id
    LEFT JOIN apnea_flag oa         ON oa.person_id = ap.person_id
    LEFT JOIN htn_diag htn          ON htn.person_id = ap.person_id
    LEFT JOIN antihtn_med aht       ON aht.person_id = ap.person_id
    LEFT JOIN morbid_obesity_diag mob ON mob.person_id = ap.person_id
    LEFT JOIN latest_bmi bmi        ON bmi.person_id = ap.person_id
),

scored AS (
    SELECT
        person_id,
        (item_s + item_t + item_o + item_p + item_b + item_a + item_n + item_g)::NUMERIC AS score_value,
        -- Confidence: neck is always proxy (7/8 max), reduce if BMI measurement missing
        ROUND(
            LEAST(
                0.875,
                (7.0 + CASE WHEN bmi_value IS NOT NULL THEN 0.125 ELSE 0 END) / 8.0
            ),
            4
        ) AS confidence,
        -- Completeness: 7 items deterministic, neck is proxy (penalise 1/8)
        ROUND(7.0 / 8.0, 4) AS completeness,
        '{"bmi_measurement":' || (CASE WHEN bmi_value IS NULL THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json
    FROM stopbang_components
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 3  THEN 'low'
            WHEN score_value < 5  THEN 'intermediate'
            ELSE 'high'
        END AS risk_tier
    FROM scored
),

total_eligible AS (
    SELECT COUNT(DISTINCT person_id) AS n FROM tiered
),

aggregated AS (
    SELECT
        t.risk_tier,
        COUNT(t.person_id)                                                        AS patient_count,
        te.n                                                                       AS total_eligible,
        ROUND(AVG(t.score_value)::NUMERIC, 4)                                     AS mean_score,
        PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY t.score_value)               AS p25_score,
        PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY t.score_value)               AS median_score,
        PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY t.score_value)               AS p75_score,
        ROUND(AVG(t.confidence)::NUMERIC, 4)                                      AS mean_confidence,
        ROUND(AVG(t.completeness)::NUMERIC, 4)                                    AS mean_completeness,
        '{"bmi_measurement":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"bmi_measurement":1%' THEN 1 ELSE 0 END)::TEXT
            || '}'                                                                 AS missing_components
    FROM tiered t
    CROSS JOIN total_eligible te
    GROUP BY t.risk_tier, te.n
)

SELECT
    risk_tier,
    patient_count,
    total_eligible,
    mean_score,
    p25_score,
    median_score,
    p75_score,
    mean_confidence,
    mean_completeness,
    missing_components
FROM aggregated
ORDER BY
    CASE risk_tier
        WHEN 'low'          THEN 1
        WHEN 'intermediate' THEN 2
        WHEN 'high'         THEN 3
    END;
SQL;
    }
}
