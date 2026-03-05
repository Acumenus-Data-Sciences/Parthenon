<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS002 – ACC/AHA 2013 Pooled Cohort Equations (ASCVD 10-Year Risk)
 *
 * The 2013 ACC/AHA guideline risk calculator uses race/sex-specific Cox
 * proportional-hazard coefficients. Four equations: White Male, White Female,
 * African-American Male, African-American Female.
 *
 * Inputs (all log-transformed in the formula):
 *   Age, Total cholesterol, HDL cholesterol, Systolic BP (treated/untreated),
 *   Diabetes (0/1), Current smoking (0/1)
 *
 * Risk = 1 - S₀^exp(Σ(βᵢ * Xᵢ) - baseline)
 *
 * OMOP race_concept_id: 8515 = Asian, 8516 = Black/African American,
 *                        8527 = White, 8657 = Native Hawaiian/Pacific Islander
 * For races other than White/Black, White coefficients are used (standard practice).
 */
class RS002PooledCohortEquations implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS002';
    }

    public function scoreName(): string
    {
        return 'ACC/AHA Pooled Cohort Equations (ASCVD 10-yr)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Ages 40–79, both sexes';
    }

    public function description(): string
    {
        return '2013 ACC/AHA race/sex-specific Cox model for 10-year ASCVD risk. Four equations (White/African-American × Male/Female). Uses log-transformed continuous variables with validated coefficients.';
    }

    public function requiredComponents(): array
    {
        return ['age', 'sex', 'race', 'total_cholesterol', 'hdl_cholesterol',
            'systolic_bp', 'bp_treatment', 'diabetes', 'smoking_status'];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [null,  7.5],
            'borderline' => [7.5,  10.0],
            'intermediate' => [10.0, 20.0],
            'high' => [20.0, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'measurement', 'condition_occurrence', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH eligible AS (
                SELECT p.person_id, p.gender_concept_id, p.race_concept_id,
                       LN(EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth,7), COALESCE(p.day_of_birth,1))))
                       ) AS ln_age,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth,7), COALESCE(p.day_of_birth,1))))::INT AS age
                FROM {@cdmSchema}.person p
                WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                          MAKE_DATE(p.year_of_birth,
                              COALESCE(p.month_of_birth,7), COALESCE(p.day_of_birth,1))))
                      BETWEEN 40 AND 79
                  AND p.gender_concept_id IN (8507, 8532)
            ),
            latest_tc  AS (SELECT DISTINCT ON (person_id) person_id, LN(value_as_number) AS ln_tc, value_as_number AS tc FROM {@cdmSchema}.measurement WHERE measurement_concept_id IN (3027114, 3019900) AND value_as_number BETWEEN 130 AND 600 ORDER BY person_id, measurement_date DESC),
            latest_hdl AS (SELECT DISTINCT ON (person_id) person_id, LN(value_as_number) AS ln_hdl, value_as_number AS hdl FROM {@cdmSchema}.measurement WHERE measurement_concept_id IN (3007070, 3011884) AND value_as_number BETWEEN 10 AND 200 ORDER BY person_id, measurement_date DESC),
            latest_sbp AS (SELECT DISTINCT ON (person_id) person_id, LN(value_as_number) AS ln_sbp, value_as_number AS sbp FROM {@cdmSchema}.measurement WHERE measurement_concept_id = 3004249 AND value_as_number BETWEEN 40 AND 300 ORDER BY person_id, measurement_date DESC),
            smokers    AS (SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence WHERE condition_concept_id IN (436070,442277,4198553,4144272,317002,40484092)),
            diabetics  AS (SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence WHERE condition_concept_id IN (201826,201254,443238,4193704)),
            on_bp_med  AS (SELECT DISTINCT de.person_id FROM {@cdmSchema}.drug_exposure de JOIN {@cdmSchema}.concept_ancestor ca ON de.drug_concept_id = ca.descendant_concept_id WHERE ca.ancestor_concept_id IN (1340128,1353776,1746580,904542,974166,1308216,1367500,1373928,1386957,1395058) AND de.drug_concept_id != 0),
            components AS (
                SELECT e.*, tc.ln_tc, tc.tc, hdl.ln_hdl, hdl.hdl, sbp.ln_sbp, sbp.sbp,
                       CASE WHEN sm.person_id IS NOT NULL THEN 1 ELSE 0 END AS smoker,
                       CASE WHEN dm.person_id IS NOT NULL THEN 1 ELSE 0 END AS diabetic,
                       CASE WHEN bp.person_id IS NOT NULL THEN 1 ELSE 0 END AS bp_treated,
                       (CASE WHEN tc.tc  IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN hdl.hdl IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN sbp.sbp IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / 3 AS lab_completeness,
                       ROUND((4 + CASE WHEN tc.tc   IS NOT NULL THEN 2 ELSE 0 END +
                                  CASE WHEN hdl.hdl IS NOT NULL THEN 2 ELSE 0 END +
                                  CASE WHEN sbp.sbp IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / 9, 4) AS confidence
                FROM eligible e
                LEFT JOIN latest_tc  tc  ON e.person_id = tc.person_id
                LEFT JOIN latest_hdl hdl ON e.person_id = hdl.person_id
                LEFT JOIN latest_sbp sbp ON e.person_id = sbp.person_id
                LEFT JOIN smokers    sm  ON e.person_id = sm.person_id
                LEFT JOIN diabetics  dm  ON e.person_id = dm.person_id
                LEFT JOIN on_bp_med  bp  ON e.person_id = bp.person_id
            ),
            -- ACC/AHA PCE pooled coefficients (2013 Goff et al.)
            scored AS (
                SELECT c.*,
                  CASE WHEN tc IS NULL OR hdl IS NULL OR sbp IS NULL THEN NULL
                  ELSE ROUND(
                    CASE
                      -- African-American Female (race_concept_id = 8516, sex = 8532)
                      WHEN gender_concept_id = 8532 AND race_concept_id = 8516 THEN
                        (1 - POWER(0.9533, EXP(
                            17.1141 * ln_age +
                             0.9396 * ln_tc  +
                            -18.9196 * ln_hdl + 4.4748 * ln_age * ln_hdl +
                            29.2907 * CASE WHEN bp_treated=0 THEN ln_sbp ELSE 0 END +
                            27.8197 * CASE WHEN bp_treated=1 THEN ln_sbp ELSE 0 END +
                             0.8738 * smoker +
                             0.8738 * diabetic
                            - 86.6081))) * 100
                      -- White Female (or other non-Black female)
                      WHEN gender_concept_id = 8532 THEN
                        (1 - POWER(0.9665, EXP(
                            -29.799 * ln_age + 4.884 * ln_age * ln_age +
                             13.540 * ln_tc  - 3.114 * ln_age * ln_tc  +
                            -13.578 * ln_hdl + 3.149 * ln_age * ln_hdl +
                             2.019  * CASE WHEN bp_treated=0 THEN ln_sbp ELSE 0 END +
                             1.957  * CASE WHEN bp_treated=1 THEN ln_sbp ELSE 0 END +
                             7.574  * smoker - 1.665 * ln_age * smoker +
                             0.661  * diabetic
                            - (-29.18)))) * 100
                      -- African-American Male
                      WHEN gender_concept_id = 8507 AND race_concept_id = 8516 THEN
                        (1 - POWER(0.8954, EXP(
                             2.469  * ln_age +
                             0.302  * ln_tc  +
                            -0.307  * ln_hdl +
                             1.916  * CASE WHEN bp_treated=0 THEN ln_sbp ELSE 0 END +
                             1.809  * CASE WHEN bp_treated=1 THEN ln_sbp ELSE 0 END +
                             0.549  * smoker +
                             0.645  * diabetic
                            - 19.54))) * 100
                      -- White Male (or other non-Black male)
                      ELSE
                        (1 - POWER(0.9144, EXP(
                            12.344 * ln_age +
                             11.853 * ln_tc  - 2.664 * ln_age * ln_tc  +
                            -7.990  * ln_hdl + 1.769 * ln_age * ln_hdl +
                             1.797  * CASE WHEN bp_treated=0 THEN ln_sbp ELSE 0 END +
                             1.764  * CASE WHEN bp_treated=1 THEN ln_sbp ELSE 0 END +
                             7.837  * smoker - 1.795 * ln_age * smoker +
                             0.658  * diabetic
                            - 61.18))) * 100
                    END, 2)
                  END AS risk_pct
                FROM components c
            ),
            tiered AS (
                SELECT *,
                    CASE WHEN risk_pct IS NULL   THEN 'uncomputable'
                         WHEN risk_pct <  7.5    THEN 'low'
                         WHEN risk_pct < 10.0    THEN 'borderline'
                         WHEN risk_pct < 20.0    THEN 'intermediate'
                         ELSE                         'high' END AS risk_tier
                FROM scored
            )
            SELECT risk_tier,
                COUNT(*)                                                                AS patient_count,
                (SELECT COUNT(*) FROM eligible)                                         AS total_eligible,
                ROUND(AVG(risk_pct), 4)                                                AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY risk_pct)                 AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY risk_pct)                 AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY risk_pct)                 AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                     AS mean_confidence,
                ROUND(AVG(lab_completeness)::NUMERIC, 4)                               AS mean_completeness,
                '{"total_cholesterol":' || SUM(CASE WHEN tc  IS NULL THEN 1 ELSE 0 END) ||
                ',"hdl_cholesterol":'   || SUM(CASE WHEN hdl IS NULL THEN 1 ELSE 0 END) ||
                ',"systolic_bp":'       || SUM(CASE WHEN sbp IS NULL THEN 1 ELSE 0 END) || '}' AS missing_components
            FROM tiered
            GROUP BY risk_tier
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'borderline' THEN 3 WHEN 'low' THEN 4 ELSE 5 END
            SQL;
    }
}
