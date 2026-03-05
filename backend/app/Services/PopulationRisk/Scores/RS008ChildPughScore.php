<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS008 – Child-Pugh Score (Cirrhosis Severity)
 *
 * Assesses prognosis of chronic liver disease (primarily cirrhosis) using
 * five clinical criteria, each scored 1–3. Total score 5–15 maps to
 * Class A (compensated), B (significant compromise), C (decompensated).
 *
 * Scoring criteria:
 *   1. Bilirubin (mg/dL): <2 → 1, 2–3 → 2, >3 → 3
 *      OMOP concept 3024128 (LOINC 1975-2)
 *   2. Albumin (g/dL):    >3.5 → 1, 2.8–3.5 → 2, <2.8 → 3
 *      OMOP concept 3024629 (LOINC 1751-7)
 *   3. INR:               <1.7 → 1, 1.7–2.3 → 2, >2.3 → 3
 *      OMOP concept 3022217 (LOINC 6301-6)
 *   4. Ascites:           absent (no dx) → 1, present (200528) → 2,
 *                         severe/refractory: use same concept, score 2
 *                         (3-point grading not reliably codeable in OMOP)
 *   5. Hepatic encephalopathy: absent → 1, any grade (372448) → 2
 *                         (Grades 3-4 not reliably distinguishable without notes)
 *
 * Total 5–6 → Class A (low); 7–9 → Class B (intermediate); 10–15 → Class C (high)
 *
 * Eligible: cirrhosis (4064161), liver fibrosis (4245975), chronic liver disease (443767)
 *
 * Confidence based on lab availability:
 *   confidence = (bil_present + alb_present + inr_present + 2) / 5
 *   (ascites and encephalopathy from conditions assumed present/absent; weight = 1 each)
 *
 * OMOP concepts:
 *   3024128 – Bilirubin total
 *   3024629 – Albumin [Mass/vol] in Serum or Plasma (LOINC 1751-7)
 *   3022217 – INR
 *   200528  – Ascites
 *   372448  – Hepatic encephalopathy
 *   4064161 – Cirrhosis of liver
 *   4245975 – Fibrosis of liver
 *   443767  – Chronic liver disease
 */
class RS008ChildPughScore implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS008';
    }

    public function scoreName(): string
    {
        return 'Child-Pugh Score (Cirrhosis Severity)';
    }

    public function category(): string
    {
        return 'Hepatic';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with cirrhosis or chronic liver disease';
    }

    public function description(): string
    {
        return 'Child-Pugh score for cirrhosis severity and prognosis using bilirubin, albumin, INR, ascites, and hepatic encephalopathy. Class A (5-6 pts) = well-compensated; Class B (7-9) = significant functional compromise; Class C (10-15) = decompensated cirrhosis with poor prognosis. Guides surgical risk and transplant eligibility assessment.';
    }

    public function requiredComponents(): array
    {
        return [
            'liver_disease_diagnosis',
            'bilirubin',
            'albumin',
            'inr',
            'ascites',
            'encephalopathy',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'class_a' => [5,  7],
            'class_b' => [7,  10],
            'class_c' => [10, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'measurement'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH liver_patients AS (
                -- Eligible: patients with cirrhosis or chronic liver disease
                SELECT DISTINCT p.person_id
                FROM {@cdmSchema}.person p
                WHERE EXISTS (
                    SELECT 1 FROM {@cdmSchema}.condition_occurrence co
                    WHERE co.person_id = p.person_id
                      AND co.condition_concept_id IN (4064161, 4245975, 443767)
                )
            ),
            -- Latest bilirubin (mg/dL): concept 3024128 (LOINC 1975-2)
            latest_bilirubin AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS bilirubin
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3024128
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- Latest albumin (g/dL): concept 3024629 (LOINC 1751-7)
            latest_albumin AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS albumin
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3024629
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- Latest INR: concept 3022217 (LOINC 6301-6)
            latest_inr AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS inr
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3022217
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            ascites AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 200528
            ),
            encephalopathy AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 372448
            ),
            components AS (
                SELECT
                    lp.person_id,
                    bil.bilirubin,
                    alb.albumin,
                    inr.inr,
                    CASE WHEN asc_dx.person_id IS NOT NULL THEN 1 ELSE 0 END  AS has_ascites,
                    CASE WHEN enc.person_id    IS NOT NULL THEN 1 ELSE 0 END  AS has_enceph,
                    -- Lab presence flags
                    CASE WHEN bil.bilirubin IS NOT NULL THEN 1 ELSE 0 END     AS bil_present,
                    CASE WHEN alb.albumin   IS NOT NULL THEN 1 ELSE 0 END     AS alb_present,
                    CASE WHEN inr.inr       IS NOT NULL THEN 1 ELSE 0 END     AS inr_present
                FROM liver_patients lp
                LEFT JOIN latest_bilirubin bil    ON lp.person_id = bil.person_id
                LEFT JOIN latest_albumin   alb    ON lp.person_id = alb.person_id
                LEFT JOIN latest_inr       inr    ON lp.person_id = inr.person_id
                LEFT JOIN ascites          asc_dx ON lp.person_id = asc_dx.person_id
                LEFT JOIN encephalopathy   enc    ON lp.person_id = enc.person_id
            ),
            scored AS (
                SELECT
                    c.*,
                    -- Child-Pugh points per criterion
                    COALESCE(
                        CASE
                            WHEN bilirubin < 2.0 THEN 1
                            WHEN bilirubin <= 3.0 THEN 2
                            ELSE 3
                        END, 2)                                                AS bili_pts,   -- default 2 if unknown
                    COALESCE(
                        CASE
                            WHEN albumin > 3.5  THEN 1
                            WHEN albumin >= 2.8 THEN 2
                            ELSE 3
                        END, 2)                                                AS alb_pts,    -- default 2 if unknown
                    COALESCE(
                        CASE
                            WHEN inr < 1.7  THEN 1
                            WHEN inr <= 2.3 THEN 2
                            ELSE 3
                        END, 2)                                                AS inr_pts,    -- default 2 if unknown
                    -- Ascites: absent=1, any coded ascites=2
                    CASE WHEN has_ascites = 1 THEN 2 ELSE 1 END               AS ascites_pts,
                    -- Encephalopathy: absent=1, any coded HE=2
                    CASE WHEN has_enceph  = 1 THEN 2 ELSE 1 END               AS enceph_pts,
                    -- Confidence: (3 labs + 2 condition items) / 5
                    ROUND((bil_present + alb_present + inr_present + 2)::NUMERIC / 5, 4) AS confidence,
                    ROUND((bil_present + alb_present + inr_present + 2)::NUMERIC / 5, 4) AS completeness
                FROM components c
            ),
            totals AS (
                SELECT *,
                    COALESCE(bili_pts, 2) +
                    COALESCE(alb_pts, 2)  +
                    COALESCE(inr_pts, 2)  +
                    ascites_pts           +
                    enceph_pts            AS child_pugh_score
                FROM scored
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN child_pugh_score >= 10 THEN 'class_c'
                        WHEN child_pugh_score >=  7 THEN 'class_b'
                        ELSE 'class_a'
                    END AS risk_tier
                FROM totals
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM liver_patients)                                              AS total_eligible,
                ROUND(AVG(child_pugh_score), 4)                                                    AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY child_pugh_score)                     AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY child_pugh_score)                     AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY child_pugh_score)                     AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"bilirubin":' || SUM(CASE WHEN bilirubin IS NULL THEN 1 ELSE 0 END) ||
                ',"albumin":'   || SUM(CASE WHEN albumin   IS NULL THEN 1 ELSE 0 END) ||
                ',"inr":'       || SUM(CASE WHEN inr       IS NULL THEN 1 ELSE 0 END) ||
                '}'                                                                                AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'class_c' THEN 1 WHEN 'class_b' THEN 2
                                    WHEN 'class_a'  THEN 3 ELSE 4 END
            SQL;
    }
}
