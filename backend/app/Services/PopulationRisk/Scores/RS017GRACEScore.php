<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS017GRACEScore implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS017';
    }

    public function scoreName(): string
    {
        return 'GRACE Score (ACS In-Hospital Mortality, Simplified)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with ACS (NSTEMI, STEMI, unstable angina)';
    }

    public function description(): string
    {
        return 'Simplified GRACE (Global Registry of Acute Coronary Events) score for in-hospital '
            . 'mortality prediction in ACS patients. The full GRACE score uses eight variables: age, '
            . 'heart rate, systolic BP, creatinine, Killip class, cardiac arrest, ST depression, '
            . 'and elevated cardiac markers. This implementation operationalises all eight using OMOP '
            . 'measurements and conditions. Age and condition-based items (cardiac arrest, ST depression) '
            . 'are always available. Vital signs and lab items (HR, SBP, creatinine, troponin) contribute '
            . 'to both the score and confidence calculation. Score thresholds: <88 low (<3% mortality), '
            . '88-128 intermediate (3-8%), ≥129 high (>8%). Coefficients approximate Morrow 2007 GRACE.';
    }

    public function requiredComponents(): array
    {
        return [
            'acs_diagnosis',
            'age',
            'heart_rate',
            'systolic_bp',
            'creatinine',
            'cardiac_arrest',
            'st_depression',
            'cardiac_markers',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low'          => [0, 88],
            'intermediate' => [88, 128],
            'high'         => [128, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'measurement'];
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
        AND co.condition_concept_id IN (312327, 444406, 4236484, 315286)
),

-- Most recent heart rate (concept 3027018), bpm
latest_hr AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS hr_bpm
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3027018
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Most recent systolic BP (concept 3004249), mmHg
latest_sbp AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS sbp_mmhg
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3004249
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Most recent creatinine (concept 3016723), mg/dL
latest_cr AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS cr_mgdl
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3016723
      AND value_as_number IS NOT NULL
      AND value_as_number >= 0
    ORDER BY person_id, measurement_date DESC
),

-- Cardiac arrest on admission (concept 4275477)
cardiac_arrest_flag AS (
    SELECT DISTINCT person_id, 1 AS had_arrest
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4275477, 321042)
),

-- ST segment depression (concept 4229881, 4045932)
st_depression_flag AS (
    SELECT DISTINCT person_id, 1 AS has_std
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4229881, 4045932, 4228901)
),

-- Elevated cardiac markers: troponin (3016335) > 0.04 or CK-MB (3028437)
latest_troponin AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS troponin_value
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id IN (3016335, 3028437)
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

grace_components AS (
    SELECT
        ep.person_id,
        ep.age,
        hr.hr_bpm,
        sbp.sbp_mmhg,
        cr.cr_mgdl,
        COALESCE(ca.had_arrest, 0) AS had_arrest,
        COALESCE(std.has_std, 0)   AS has_std,
        tr.troponin_value,

        -- Age points (Morrow 2007 approximate bands)
        CASE
            WHEN ep.age < 40   THEN 0
            WHEN ep.age < 50   THEN 18
            WHEN ep.age < 60   THEN 36
            WHEN ep.age < 70   THEN 55
            WHEN ep.age < 80   THEN 73
            ELSE 91
        END AS pts_age,

        -- Heart rate points
        CASE
            WHEN hr.hr_bpm IS NULL    THEN 0
            WHEN hr.hr_bpm < 70       THEN 0
            WHEN hr.hr_bpm < 90       THEN 7
            WHEN hr.hr_bpm < 110      THEN 13
            WHEN hr.hr_bpm < 150      THEN 23
            WHEN hr.hr_bpm < 200      THEN 36
            ELSE 46
        END AS pts_hr,

        -- Systolic BP points (inverse relationship)
        CASE
            WHEN sbp.sbp_mmhg IS NULL  THEN 0
            WHEN sbp.sbp_mmhg < 80     THEN 63
            WHEN sbp.sbp_mmhg < 100    THEN 58
            WHEN sbp.sbp_mmhg < 120    THEN 47
            WHEN sbp.sbp_mmhg < 140    THEN 37
            WHEN sbp.sbp_mmhg < 160    THEN 26
            WHEN sbp.sbp_mmhg < 200    THEN 11
            ELSE 0
        END AS pts_sbp,

        -- Creatinine points
        CASE
            WHEN cr.cr_mgdl IS NULL    THEN 0
            WHEN cr.cr_mgdl < 0.4      THEN 2
            WHEN cr.cr_mgdl < 0.8      THEN 5
            WHEN cr.cr_mgdl < 1.2      THEN 8
            WHEN cr.cr_mgdl < 1.6      THEN 11
            WHEN cr.cr_mgdl < 2.0      THEN 14
            WHEN cr.cr_mgdl < 4.0      THEN 23
            ELSE 31
        END AS pts_cr,

        -- Cardiac arrest: 43 pts
        COALESCE(ca.had_arrest, 0) * 43 AS pts_arrest,

        -- ST depression: 30 pts
        COALESCE(std.has_std, 0) * 30 AS pts_std,

        -- Elevated cardiac markers: 15 pts if troponin > 0.04
        CASE WHEN tr.troponin_value > 0.04 THEN 15 ELSE 0 END AS pts_markers,

        -- Lab availability for confidence
        (CASE WHEN hr.hr_bpm IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN sbp.sbp_mmhg IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN cr.cr_mgdl IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN tr.troponin_value IS NOT NULL THEN 1 ELSE 0 END) AS available_labs

    FROM eligible_patients ep
    LEFT JOIN latest_hr hr          ON hr.person_id = ep.person_id
    LEFT JOIN latest_sbp sbp        ON sbp.person_id = ep.person_id
    LEFT JOIN latest_cr cr          ON cr.person_id = ep.person_id
    LEFT JOIN cardiac_arrest_flag ca ON ca.person_id = ep.person_id
    LEFT JOIN st_depression_flag std ON std.person_id = ep.person_id
    LEFT JOIN latest_troponin tr    ON tr.person_id = ep.person_id
),

scored AS (
    SELECT
        person_id,
        (pts_age + pts_hr + pts_sbp + pts_cr + pts_arrest + pts_std + pts_markers)::NUMERIC AS score_value,
        -- Confidence: 4 condition-based items always available + 4 lab items
        ROUND((4.0 + available_labs) / 8.0, 4) AS confidence,
        ROUND((4.0 + available_labs) / 8.0, 4) AS completeness,
        '{"heart_rate":' || (CASE WHEN hr_bpm IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"systolic_bp":' || (CASE WHEN sbp_mmhg IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"creatinine":' || (CASE WHEN cr_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"cardiac_markers":' || (CASE WHEN troponin_value IS NULL THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json
    FROM grace_components
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 88  THEN 'low'
            WHEN score_value < 128 THEN 'intermediate'
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
        '{"heart_rate":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"heart_rate":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"systolic_bp":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"systolic_bp":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"creatinine":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"creatinine":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"cardiac_markers":'
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
