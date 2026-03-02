<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS001 – Framingham Risk Score (Wilson 1998 / ATP-III revision)
 *
 * Estimates 10-year risk of cardiovascular disease (coronary heart disease).
 * Validated for ages 30–74. Sex-specific point tables.
 *
 * Required OMOP concept IDs (standard LOINC mappings):
 *   3027114 – Total cholesterol       (LOINC 2093-3)
 *   3007070 – HDL cholesterol         (LOINC 2085-9)
 *   3004249 – Systolic BP             (LOINC 8480-6)
 *
 * Missing data handling:
 *   - Smoking / diabetes / BP treatment → assumed absent if no record found (0 points)
 *   - Cholesterol / HDL / SBP → score is 'uncomputable' if any are missing
 *   - Confidence penalised proportionally to missing lab components
 */
class RS001FraminghamRiskScore implements PopulationRiskScoreInterface
{
    public function scoreId(): string       { return 'RS001'; }
    public function scoreName(): string     { return 'Framingham Risk Score (10-yr CVD)'; }
    public function category(): string      { return 'Cardiovascular'; }
    public function eligiblePopulation(): string { return 'Ages 30–74, both sexes'; }

    public function description(): string
    {
        return 'Estimates 10-year cardiovascular disease risk using age, sex, total cholesterol, HDL, systolic BP (treated/untreated), smoking, and diabetes. Wilson 1998 point-based algorithm.';
    }

    public function requiredComponents(): array
    {
        return ['age', 'sex', 'total_cholesterol', 'hdl_cholesterol', 'systolic_bp',
                'smoking_status', 'diabetes', 'bp_treatment'];
    }

    public function riskTiers(): array
    {
        return [
            'low'          => [null, 10],
            'intermediate' => [10,   20],
            'high'         => [20, null],
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
                SELECT p.person_id,
                       p.gender_concept_id,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth, 7),
                               COALESCE(p.day_of_birth, 1))))::INT AS age
                FROM {@cdmSchema}.person p
                WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                          MAKE_DATE(p.year_of_birth,
                              COALESCE(p.month_of_birth, 7),
                              COALESCE(p.day_of_birth, 1))))
                      BETWEEN 30 AND 74
                  AND p.gender_concept_id IN (8507, 8532)
            ),
            latest_tc AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS tc
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id IN (3027114, 3019900)
                  AND value_as_number BETWEEN 100 AND 600
                ORDER BY person_id, measurement_date DESC
            ),
            latest_hdl AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS hdl
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id IN (3007070, 3011884)
                  AND value_as_number BETWEEN 10 AND 200
                ORDER BY person_id, measurement_date DESC
            ),
            latest_sbp AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS sbp
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3004249
                  AND value_as_number BETWEEN 40 AND 300
                ORDER BY person_id, measurement_date DESC
            ),
            smokers AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (436070, 442277, 4198553, 4144272, 317002, 40484092)
            ),
            diabetics AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (201826, 201254, 443238, 4193704)
            ),
            on_bp_med AS (
                SELECT DISTINCT de.person_id
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca ON de.drug_concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id IN (
                    1340128, 1353776, 1746580, 904542, 974166,
                    1308216, 1367500, 1373928, 1386957, 1395058
                ) AND de.drug_concept_id != 0
            ),
            components AS (
                SELECT e.person_id, e.gender_concept_id, e.age,
                       tc.tc, hdl.hdl, sbp.sbp,
                       CASE WHEN sm.person_id IS NOT NULL THEN 1 ELSE 0 END AS smoker,
                       CASE WHEN dm.person_id IS NOT NULL THEN 1 ELSE 0 END AS diabetic,
                       CASE WHEN bp.person_id IS NOT NULL THEN 1 ELSE 0 END AS bp_treated,
                       -- Completeness: labs are required; others assumed 0 if absent
                       (CASE WHEN tc.tc   IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN hdl.hdl IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN sbp.sbp IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / 3 AS lab_completeness,
                       -- Full confidence = 1.0 only with all 3 labs; penalise proportionally
                       -- (smoking/diabetes/BP assumed 0 if absent — standard epidemiologic approach)
                       ROUND((3 +
                              CASE WHEN tc.tc   IS NOT NULL THEN 2 ELSE 0 END +
                              CASE WHEN hdl.hdl IS NOT NULL THEN 2 ELSE 0 END +
                              CASE WHEN sbp.sbp IS NOT NULL THEN 1 ELSE 0 END
                             )::NUMERIC / 8, 4) AS confidence
                FROM eligible e
                LEFT JOIN latest_tc  tc  ON e.person_id = tc.person_id
                LEFT JOIN latest_hdl hdl ON e.person_id = hdl.person_id
                LEFT JOIN latest_sbp sbp ON e.person_id = sbp.person_id
                LEFT JOIN smokers    sm  ON e.person_id = sm.person_id
                LEFT JOIN diabetics  dm  ON e.person_id = dm.person_id
                LEFT JOIN on_bp_med  bp  ON e.person_id = bp.person_id
            ),
            -- Wilson 1998 point assignment (sex-specific)
            points AS (
                SELECT c.*,
                    CASE WHEN tc IS NULL OR hdl IS NULL OR sbp IS NULL THEN NULL
                    ELSE
                    -- Age points
                    CASE WHEN gender_concept_id = 8507 THEN
                        CASE WHEN age < 35 THEN -1 WHEN age < 40 THEN 0 WHEN age < 45 THEN 1
                             WHEN age < 50 THEN 2  WHEN age < 55 THEN 3 WHEN age < 60 THEN 4
                             WHEN age < 65 THEN 5  WHEN age < 70 THEN 6 ELSE 7 END
                    ELSE
                        CASE WHEN age < 35 THEN -9 WHEN age < 40 THEN -4 WHEN age < 45 THEN 0
                             WHEN age < 50 THEN 3  WHEN age < 55 THEN 6  WHEN age < 60 THEN 7
                             ELSE 8 END
                    END
                    -- Total cholesterol points
                    + CASE WHEN gender_concept_id = 8507 THEN
                        CASE WHEN tc < 160 THEN -3 WHEN tc < 200 THEN 0 WHEN tc < 240 THEN 1
                             WHEN tc < 280 THEN 2  ELSE 3 END
                      ELSE
                        CASE WHEN tc < 160 THEN -2 WHEN tc < 200 THEN 0 WHEN tc < 240 THEN 1
                             WHEN tc < 280 THEN 1  ELSE 3 END
                      END
                    -- HDL points
                    + CASE WHEN hdl >= 60 THEN -2 WHEN hdl >= 45 THEN 0
                           WHEN hdl >= 35 THEN 1  ELSE 2 END
                    -- SBP points (treatment-adjusted, sex-specific)
                    + CASE WHEN bp_treated = 1 THEN
                        CASE WHEN gender_concept_id = 8507 THEN
                            CASE WHEN sbp < 120 THEN 0 WHEN sbp < 130 THEN 2
                                 WHEN sbp < 140 THEN 3 WHEN sbp < 160 THEN 4 ELSE 5 END
                        ELSE
                            CASE WHEN sbp < 120 THEN -1 WHEN sbp < 130 THEN 2
                                 WHEN sbp < 140 THEN 3  WHEN sbp < 160 THEN 5 ELSE 7 END
                        END
                      ELSE  -- untreated
                        CASE WHEN gender_concept_id = 8507 THEN
                            CASE WHEN sbp < 120 THEN 0 WHEN sbp < 130 THEN 0
                                 WHEN sbp < 140 THEN 1 WHEN sbp < 160 THEN 2 ELSE 3 END
                        ELSE
                            CASE WHEN sbp < 120 THEN -3 WHEN sbp < 130 THEN 0
                                 WHEN sbp < 140 THEN 1  WHEN sbp < 160 THEN 2 ELSE 4 END
                        END
                      END
                    -- Smoking
                    + CASE WHEN smoker = 1 THEN
                        CASE WHEN gender_concept_id = 8507 THEN 4 ELSE 3 END
                      ELSE 0 END
                    -- Diabetes
                    + CASE WHEN diabetic = 1 THEN
                        CASE WHEN gender_concept_id = 8507 THEN 3 ELSE 6 END
                      ELSE 0 END
                    END AS pt
                FROM components c
            ),
            -- Convert points to 10-year risk % (sex-specific survival function)
            scored AS (
                SELECT p.*,
                    CASE WHEN pt IS NOT NULL THEN
                        CASE WHEN gender_concept_id = 8507 THEN
                            ROUND((1 - POWER(0.9048, EXP(pt - 23.9802))) * 100, 2)
                        ELSE
                            ROUND((1 - POWER(0.9665, EXP(pt - 26.1931))) * 100, 2)
                        END
                    ELSE NULL END AS risk_pct,
                    CASE WHEN tc IS NULL THEN '"total_cholesterol":1,' ELSE '"total_cholesterol":0,' END ||
                    CASE WHEN hdl IS NULL THEN '"hdl_cholesterol":1,' ELSE '"hdl_cholesterol":0,' END ||
                    CASE WHEN sbp IS NULL THEN '"systolic_bp":1'      ELSE '"systolic_bp":0'      END
                        AS miss_json
                FROM points p
            ),
            tiered AS (
                SELECT s.*,
                    CASE WHEN risk_pct IS NULL      THEN 'uncomputable'
                         WHEN risk_pct < 10         THEN 'low'
                         WHEN risk_pct < 20         THEN 'intermediate'
                         ELSE                            'high' END AS risk_tier
                FROM scored s
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                    AS patient_count,
                (SELECT COUNT(*) FROM eligible)                                             AS total_eligible,
                ROUND(AVG(risk_pct), 4)                                                    AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY risk_pct)                     AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY risk_pct)                     AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY risk_pct)                     AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                         AS mean_confidence,
                ROUND(AVG(lab_completeness)::NUMERIC, 4)                                   AS mean_completeness,
                '{' ||
                    '"total_cholesterol":' || SUM(CASE WHEN tc  IS NULL THEN 1 ELSE 0 END) || ',' ||
                    '"hdl_cholesterol":'   || SUM(CASE WHEN hdl IS NULL THEN 1 ELSE 0 END) || ',' ||
                    '"systolic_bp":'       || SUM(CASE WHEN sbp IS NULL THEN 1 ELSE 0 END) ||
                '}'                                                                        AS missing_components
            FROM tiered
            GROUP BY risk_tier
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low' THEN 3 ELSE 4 END
            SQL;
    }
}
