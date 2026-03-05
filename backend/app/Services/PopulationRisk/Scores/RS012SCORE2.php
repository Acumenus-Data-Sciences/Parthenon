<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS012SCORE2 implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS012';
    }

    public function scoreName(): string
    {
        return 'SCORE2 (European CVD 10-yr Risk)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Ages 40–69, both sexes';
    }

    public function description(): string
    {
        return 'SCORE2 (2021) estimates 10-year risk of fatal and non-fatal cardiovascular events '
            .'in apparently healthy adults aged 40-69 without prior CVD. Uses sex-specific equations '
            .'with non-HDL cholesterol (total cholesterol minus HDL), systolic blood pressure, and '
            .'smoking status. Low-risk region coefficients are applied. non-HDL is converted from '
            .'mg/dL to mmol/L by dividing by 38.67. Output is expressed as a percentage (0-100). '
            .'Confidence scales with laboratory data availability across TC, HDL, and SBP.';
    }

    public function requiredComponents(): array
    {
        return [
            'age',
            'sex',
            'total_cholesterol',
            'hdl_cholesterol',
            'systolic_bp',
            'smoking_status',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [null, 5],
            'moderate' => [5, 10],
            'high' => [10, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'measurement', 'condition_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH eligible_patients AS (
    SELECT
        p.person_id,
        p.gender_concept_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) BETWEEN 40 AND 69
),

-- Most recent total cholesterol (concept 3027114), mg/dL
latest_tc AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS tc_mgdl
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3027114
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Most recent HDL cholesterol (concept 3007070), mg/dL
latest_hdl AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS hdl_mgdl
    FROM {cdmSchema}.measurement
    WHERE measurement_concept_id = 3007070
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

-- Smoking status: any smoking-related condition (436070 tobacco use, 442277 smoker)
smoking_flag AS (
    SELECT DISTINCT person_id, 1 AS is_smoker
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (436070, 442277)
),

labs_joined AS (
    SELECT
        ep.person_id,
        ep.gender_concept_id,
        ep.age,
        tc.tc_mgdl,
        hdl.hdl_mgdl,
        sbp.sbp_mmhg,
        COALESCE(sf.is_smoker, 0) AS is_smoker,
        -- Convert mg/dL to mmol/L
        tc.tc_mgdl / 38.67 AS tc_mmol,
        hdl.hdl_mgdl / 38.67 AS hdl_mmol,
        -- non-HDL mmol/L
        (tc.tc_mgdl - hdl.hdl_mgdl) / 38.67 AS non_hdl_mmol,
        -- Lab availability count
        (CASE WHEN tc.tc_mgdl IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN hdl.hdl_mgdl IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN sbp.sbp_mmhg IS NOT NULL THEN 1 ELSE 0 END) AS available_labs
    FROM eligible_patients ep
    LEFT JOIN latest_tc tc ON tc.person_id = ep.person_id
    LEFT JOIN latest_hdl hdl ON hdl.person_id = ep.person_id
    LEFT JOIN latest_sbp sbp ON sbp.person_id = ep.person_id
    LEFT JOIN smoking_flag sf ON sf.person_id = ep.person_id
),

scored AS (
    SELECT
        person_id,
        gender_concept_id,
        age,
        tc_mgdl,
        hdl_mgdl,
        sbp_mmhg,
        non_hdl_mmol,
        available_labs,
        is_smoker,
        -- SCORE2 sex-specific linear predictor (low-risk region coefficients)
        CASE
            WHEN gender_concept_id = 8507 AND non_hdl_mmol IS NOT NULL AND sbp_mmhg IS NOT NULL THEN
                -- Male equation
                0.3742 * ((age - 60.0) / 5.0)
                + 0.6012 * (COALESCE(non_hdl_mmol, 3.85) - 3.85)
                + (-0.2777) * ((sbp_mmhg - 120.0) / 20.0)
                + 0.6457 * is_smoker
            WHEN gender_concept_id = 8532 AND non_hdl_mmol IS NOT NULL AND sbp_mmhg IS NOT NULL THEN
                -- Female equation
                0.4648 * ((age - 60.0) / 5.0)
                + 0.7744 * (COALESCE(non_hdl_mmol, 3.85) - 3.85)
                + (-0.3580) * ((sbp_mmhg - 120.0) / 20.0)
                + 0.7127 * is_smoker
            ELSE NULL
        END AS linear_predictor,
        -- Confidence based on lab availability: (3 + available_labs * 2) / 9
        ROUND(((3 + available_labs * 2)::NUMERIC / 9.0), 4) AS confidence,
        ROUND((available_labs::NUMERIC / 3.0), 4) AS completeness,
        -- Missing components JSON
        '{"total_cholesterol":' || (CASE WHEN tc_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"hdl_cholesterol":' || (CASE WHEN hdl_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"systolic_bp":' || (CASE WHEN sbp_mmhg IS NULL THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json
    FROM labs_joined
),

risk_computed AS (
    SELECT
        person_id,
        linear_predictor,
        confidence,
        completeness,
        missing_components_json,
        -- 10-year risk as percentage
        CASE
            WHEN gender_concept_id = 8507 AND linear_predictor IS NOT NULL THEN
                ROUND(((1.0 - POWER(0.9605, EXP(linear_predictor))) * 100.0)::NUMERIC, 4)
            WHEN gender_concept_id = 8532 AND linear_predictor IS NOT NULL THEN
                ROUND(((1.0 - POWER(0.9776, EXP(linear_predictor))) * 100.0)::NUMERIC, 4)
            ELSE NULL
        END AS score_value
    FROM scored
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value IS NULL THEN 'low'
            WHEN score_value < 5.0  THEN 'low'
            WHEN score_value < 10.0 THEN 'moderate'
            ELSE 'high'
        END AS risk_tier
    FROM risk_computed
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
        '{"total_cholesterol":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"total_cholesterol":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"hdl_cholesterol":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"hdl_cholesterol":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"systolic_bp":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"systolic_bp":1%' THEN 1 ELSE 0 END)::TEXT
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
        WHEN 'low'      THEN 1
        WHEN 'moderate' THEN 2
        WHEN 'high'     THEN 3
    END;
SQL;
    }
}
