<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS015TIMIRiskScore implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS015';
    }

    public function scoreName(): string
    {
        return 'TIMI Risk Score (UA/NSTEMI)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with unstable angina or NSTEMI diagnosis';
    }

    public function description(): string
    {
        return 'TIMI Risk Score for Unstable Angina/NSTEMI (0-7 points) predicts 14-day risk of '
            . 'death, MI, or urgent revascularization. Seven components: age ≥65, ≥3 CAD risk factors, '
            . 'prior coronary stenosis ≥50%, ST changes on ECG, ≥2 anginal events in 24h (proxied by '
            . 'recent angina diagnoses), aspirin use in past 7 days (proxied by 90-day use), and '
            . 'elevated cardiac markers (troponin or CK-MB). Eligible patients have unstable angina '
            . '(315286) or NSTEMI (444406) in condition_occurrence. Confidence scales with troponin '
            . 'availability as the most uncertain component.';
    }

    public function requiredComponents(): array
    {
        return [
            'age',
            'cad_risk_factors',
            'prior_stenosis',
            'st_changes',
            'anginal_events',
            'aspirin_use',
            'cardiac_markers',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low'          => [0, 3],
            'intermediate' => [3, 5],
            'high'         => [5, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'drug_exposure', 'measurement', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH eligible_patients AS (
    SELECT DISTINCT
        p.person_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    INNER JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = p.person_id
        AND co.condition_concept_id IN (315286, 444406)
),

-- Component 1: Age >= 65
age_flag AS (
    SELECT person_id, CASE WHEN age >= 65 THEN 1 ELSE 0 END AS pts_age
    FROM eligible_patients
),

-- Component 2: >= 3 CAD risk factors (HTN, hyperlipidemia, DM, smoking, family history proxy)
-- Family history not in CDM reliably; count available 4: HTN 316866, hyperlipidemia 432867, DM 201826, smoking 436070
cad_rf AS (
    SELECT
        ep.person_id,
        COUNT(DISTINCT co.condition_concept_id) AS rf_count,
        CASE WHEN COUNT(DISTINCT
            CASE WHEN co.condition_concept_id IN (316866, 432867, 201826, 436070, 442277) THEN co.condition_concept_id END
        ) >= 3 THEN 1 ELSE 0 END AS pts_rf
    FROM eligible_patients ep
    LEFT JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = ep.person_id
        AND co.condition_concept_id IN (316866, 432867, 201826, 436070, 442277)
    GROUP BY ep.person_id
),

-- Component 3: Prior coronary stenosis >= 50%: prior CABG (4180790) or PCI (2107550)
prior_stenosis AS (
    SELECT DISTINCT person_id, 1 AS pts_stenosis
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4180790, 2107550, 4314453, 4192097)
),

-- Also check procedures for PCI/CABG via concept_ancestor
prior_proc AS (
    SELECT DISTINCT de.person_id, 1 AS pts_proc
    FROM {cdmSchema}.drug_exposure de
    INNER JOIN {cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    WHERE ca.ancestor_concept_id IN (4180790, 2107550)
),

-- Component 4: ST deviation — ST elevation/depression conditions
st_changes AS (
    SELECT DISTINCT person_id, 1 AS pts_st
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4229881, 4045932, 4108832, 4110192)
),

-- Component 5: >= 2 anginal events in recent 30 days
anginal_events AS (
    SELECT
        person_id,
        CASE WHEN COUNT(*) >= 2 THEN 1 ELSE 0 END AS pts_angina
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id = 315286
      AND condition_start_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY person_id
),

-- Component 6: Aspirin use in past 7 days (proxied by 90-day window)
aspirin_use AS (
    SELECT DISTINCT de.person_id, 1 AS pts_aspirin
    FROM {cdmSchema}.drug_exposure de
    INNER JOIN {cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    WHERE ca.ancestor_concept_id = 1112807
      AND de.drug_exposure_start_date >= CURRENT_DATE - INTERVAL '90 days'
),

-- Component 7: Elevated cardiac markers — troponin (3016335) > 0.04 ng/mL or CK-MB (3028437)
latest_troponin AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS troponin_value
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id IN (3016335, 3028437)
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

cardiac_markers AS (
    SELECT
        person_id,
        troponin_value,
        CASE WHEN troponin_value > 0.04 THEN 1 ELSE 0 END AS pts_markers
    FROM latest_troponin
),

timi_scored AS (
    SELECT
        ep.person_id,
        ep.age,
        -- Sum all 7 TIMI components
        COALESCE(af.pts_age, 0)
        + COALESCE(rf.pts_rf, 0)
        + COALESCE(GREATEST(COALESCE(ps.pts_stenosis, 0), COALESCE(pp.pts_proc, 0)), 0)
        + COALESCE(stc.pts_st, 0)
        + COALESCE(ang.pts_angina, 0)
        + COALESCE(asp.pts_aspirin, 0)
        + COALESCE(cm.pts_markers, 0) AS score_value,

        -- Confidence: troponin availability most uncertain, 6 clinical factors + 1 lab
        ROUND(
            (6.0 + CASE WHEN cm.troponin_value IS NOT NULL THEN 1 ELSE 0 END) / 7.0,
            4
        ) AS confidence,

        ROUND(
            (6.0 + CASE WHEN cm.troponin_value IS NOT NULL THEN 1 ELSE 0 END) / 7.0,
            4
        ) AS completeness,

        '{"cardiac_markers":' || (CASE WHEN cm.troponin_value IS NULL THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json

    FROM eligible_patients ep
    LEFT JOIN age_flag af          ON af.person_id = ep.person_id
    LEFT JOIN cad_rf rf            ON rf.person_id = ep.person_id
    LEFT JOIN prior_stenosis ps    ON ps.person_id = ep.person_id
    LEFT JOIN prior_proc pp        ON pp.person_id = ep.person_id
    LEFT JOIN st_changes stc       ON stc.person_id = ep.person_id
    LEFT JOIN anginal_events ang   ON ang.person_id = ep.person_id
    LEFT JOIN aspirin_use asp      ON asp.person_id = ep.person_id
    LEFT JOIN cardiac_markers cm   ON cm.person_id = ep.person_id
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
    FROM timi_scored
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
        '{"cardiac_markers":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"cardiac_markers":1%' THEN 1 ELSE 0 END)::TEXT
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
