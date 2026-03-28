<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS014MetabolicSyndrome implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS014';
    }

    public function scoreName(): string
    {
        return 'Metabolic Syndrome Risk Score (IDF/NCEP-ATP III)';
    }

    public function category(): string
    {
        return 'Metabolic';
    }

    public function eligiblePopulation(): string
    {
        return 'Adult patients (≥18)';
    }

    public function description(): string
    {
        return 'IDF/NCEP-ATP III criteria: metabolic syndrome is defined as ≥3 of 5 criteria fulfilled. '
            .'Criteria: (1) elevated waist circumference (proxied by BMI ≥30 or obesity diagnosis), '
            .'(2) elevated triglycerides ≥150 mg/dL or fibrate/niacin use, '
            .'(3) low HDL (<40 mg/dL males, <50 mg/dL females), '
            .'(4) elevated BP (SBP ≥130 or DBP ≥85) or hypertension diagnosis/antihypertensive use, '
            .'(5) elevated fasting glucose ≥100 mg/dL or diabetes diagnosis. '
            .'Score 0-5 reflects the number of criteria met. '
            .'Confidence is proportional to the fraction of measurable components with data available.';
    }

    public function requiredComponents(): array
    {
        return [
            'bmi_or_obesity',
            'triglycerides',
            'hdl_cholesterol',
            'blood_pressure',
            'glucose_or_diabetes',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'no_mets' => [0, 3],
            'metabolic_syndrome' => [3, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'measurement', 'condition_occurrence', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH adult_patients AS (
    SELECT
        p.person_id,
        p.gender_concept_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {@cdmSchema}.person p
    WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 18
),

-- Criterion 1: Obesity/elevated waist circumference
-- Obesity diagnosis (433736 morbid obesity, 436583 obesity) OR BMI ≥ 30
obesity_diag AS (
    SELECT DISTINCT person_id, 1 AS obese_flag
    FROM {@cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (433736, 436583, 4119134)
),

latest_bmi AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS bmi_value
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3038553
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

-- Criterion 2: Elevated triglycerides ≥ 150 mg/dL (concept 3022192)
latest_tg AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS tg_mgdl
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3022192
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

fibrate_use AS (
    SELECT DISTINCT de.person_id, 1 AS on_fibrate
    FROM {@cdmSchema}.drug_exposure de
    INNER JOIN {@cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    WHERE ca.ancestor_concept_id = 1545996
),

-- Criterion 3: Low HDL (concept 3007070)
latest_hdl AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS hdl_mgdl
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3007070
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

-- Criterion 4: Elevated BP (SBP 3004249, DBP 3012888)
latest_sbp AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS sbp_mmhg
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3004249
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

latest_dbp AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS dbp_mmhg
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3012888
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

htn_diag AS (
    SELECT DISTINCT person_id, 1 AS has_htn
    FROM {@cdmSchema}.condition_occurrence
    WHERE condition_concept_id = 316866
),

antihypertensive_use AS (
    SELECT DISTINCT de.person_id, 1 AS on_antihtn
    FROM {@cdmSchema}.drug_exposure de
    INNER JOIN {@cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    -- ATC C02, C03, C07, C08, C09 ancestor concept IDs (use broad cardiovascular drug classes)
    WHERE ca.ancestor_concept_id IN (
        1340128,  -- lisinopril
        1308216,  -- amlodipine
        1353766,  -- atenolol
        974166,   -- hydrochlorothiazide
        1308738   -- losartan
    )
),

-- Criterion 5: Elevated fasting glucose ≥ 100 mg/dL
-- Glucose concepts: 3004501 (glucose), 3037110 (fasting glucose LOINC 1558-6)
latest_glucose AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS glucose_mgdl
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id IN (3004501, 3037110)
      AND value_as_number IS NOT NULL
    ORDER BY person_id, measurement_date DESC
),

dm_diag AS (
    SELECT DISTINCT person_id, 1 AS has_dm
    FROM {@cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (201826, 443238)
),

criteria_computed AS (
    SELECT
        ap.person_id,
        ap.gender_concept_id,

        -- Criterion 1: obesity/high waist circumference
        CASE
            WHEN COALESCE(od.obese_flag, 0) = 1 THEN 1
            WHEN bmi.bmi_value >= 30 THEN 1
            ELSE 0
        END AS crit_obesity,

        -- Criterion 2: elevated triglycerides or fibrate use
        CASE
            WHEN tg.tg_mgdl >= 150 THEN 1
            WHEN COALESCE(fib.on_fibrate, 0) = 1 THEN 1
            ELSE 0
        END AS crit_tg,

        -- Criterion 3: low HDL (sex-specific)
        CASE
            WHEN ap.gender_concept_id = 8507 AND hdl.hdl_mgdl < 40 THEN 1
            WHEN ap.gender_concept_id = 8532 AND hdl.hdl_mgdl < 50 THEN 1
            ELSE 0
        END AS crit_hdl,

        -- Criterion 4: elevated BP or treated hypertension
        CASE
            WHEN COALESCE(sbp.sbp_mmhg, 0) >= 130 THEN 1
            WHEN COALESCE(dbp.dbp_mmhg, 0) >= 85 THEN 1
            WHEN COALESCE(htn.has_htn, 0) = 1 THEN 1
            WHEN COALESCE(aht.on_antihtn, 0) = 1 THEN 1
            ELSE 0
        END AS crit_bp,

        -- Criterion 5: elevated fasting glucose or diabetes
        CASE
            WHEN COALESCE(glc.glucose_mgdl, 0) >= 100 THEN 1
            WHEN COALESCE(dm.has_dm, 0) = 1 THEN 1
            ELSE 0
        END AS crit_glucose,

        -- Component availability for confidence
        tg.tg_mgdl,
        hdl.hdl_mgdl,
        sbp.sbp_mmhg,
        glc.glucose_mgdl,
        bmi.bmi_value,
        COALESCE(od.obese_flag, 0) AS obese_flag

    FROM adult_patients ap
    LEFT JOIN obesity_diag od      ON od.person_id = ap.person_id
    LEFT JOIN latest_bmi bmi       ON bmi.person_id = ap.person_id
    LEFT JOIN latest_tg tg         ON tg.person_id = ap.person_id
    LEFT JOIN fibrate_use fib      ON fib.person_id = ap.person_id
    LEFT JOIN latest_hdl hdl       ON hdl.person_id = ap.person_id
    LEFT JOIN latest_sbp sbp       ON sbp.person_id = ap.person_id
    LEFT JOIN latest_dbp dbp       ON dbp.person_id = ap.person_id
    LEFT JOIN htn_diag htn         ON htn.person_id = ap.person_id
    LEFT JOIN antihypertensive_use aht ON aht.person_id = ap.person_id
    LEFT JOIN latest_glucose glc   ON glc.person_id = ap.person_id
    LEFT JOIN dm_diag dm           ON dm.person_id = ap.person_id
),

scored AS (
    SELECT
        person_id,
        (crit_obesity + crit_tg + crit_hdl + crit_bp + crit_glucose)::NUMERIC AS score_value,
        -- Confidence: fraction of 5 measurable components with data
        ROUND((
            CASE WHEN tg_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN hdl_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN sbp_mmhg IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN glucose_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN bmi_value IS NOT NULL OR obese_flag = 1 THEN 1 ELSE 0 END
        )::NUMERIC / 5.0, 4) AS confidence,
        ROUND((
            CASE WHEN tg_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN hdl_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN sbp_mmhg IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN glucose_mgdl IS NOT NULL THEN 1 ELSE 0 END
            + CASE WHEN bmi_value IS NOT NULL OR obese_flag = 1 THEN 1 ELSE 0 END
        )::NUMERIC / 5.0, 4) AS completeness,
        '{"triglycerides":' || (CASE WHEN tg_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"hdl_cholesterol":' || (CASE WHEN hdl_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"blood_pressure":' || (CASE WHEN sbp_mmhg IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"glucose":' || (CASE WHEN glucose_mgdl IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"bmi_or_obesity":' || (CASE WHEN bmi_value IS NULL AND obese_flag = 0 THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json
    FROM criteria_computed
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value >= 3 THEN 'metabolic_syndrome'
            ELSE 'no_mets'
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
        '{"triglycerides":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"triglycerides":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"hdl_cholesterol":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"hdl_cholesterol":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"blood_pressure":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"blood_pressure":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"glucose":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"glucose":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"bmi_or_obesity":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"bmi_or_obesity":1%' THEN 1 ELSE 0 END)::TEXT
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
        WHEN 'no_mets'            THEN 1
        WHEN 'metabolic_syndrome' THEN 2
    END;
SQL;
    }
}
