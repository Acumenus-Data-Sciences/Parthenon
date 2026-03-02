<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS007 – MELD Score (Model for End-Stage Liver Disease)
 *
 * Predicts 90-day mortality in patients with end-stage liver disease.
 * Used for liver transplant allocation (UNOS/OPTN policy).
 *
 * Formula (UNOS 2016):
 *   MELD = 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43
 *
 * Floor values (minimums to prevent negative log):
 *   bilirubin ≥ 1.0 mg/dL, INR ≥ 1.0, creatinine ≥ 1.0 mg/dL
 * Creatinine cap: 4.0 mg/dL (dialysis patients capped at 4.0)
 * Score is rounded to integer; clinical range 6–40.
 *
 * Eligible patients: those with:
 *   4064161 – Cirrhosis of liver
 *   4245975 – Fibrosis of liver (moderate/severe)
 *   196262  – Chronic viral hepatitis B
 *   194990  – Chronic viral hepatitis C
 *
 * Required OMOP lab concepts (LOINC mappings):
 *   3024128 – Bilirubin.total [Mass/vol] in Serum or Plasma (LOINC 1975-2)
 *   3022217 – INR [in Platelet poor plasma by Coagulation assay] (LOINC 6301-6)
 *   3016723 – Creatinine [Mass/vol] in Serum or Plasma (LOINC 2160-0)
 *
 * Confidence = fraction of 3 required labs present (0.33, 0.67, 1.0).
 * Score is uncomputable if any lab is missing.
 */
class RS007MELDScore implements PopulationRiskScoreInterface
{
    public function scoreId(): string       { return 'RS007'; }
    public function scoreName(): string     { return 'MELD Score (Liver Disease Severity)'; }
    public function category(): string      { return 'Hepatic'; }
    public function eligiblePopulation(): string { return 'Patients with cirrhosis or chronic liver disease'; }

    public function description(): string
    {
        return 'Model for End-Stage Liver Disease (MELD) score predicting 90-day mortality in patients awaiting liver transplantation. Computed from bilirubin, INR, and creatinine using UNOS 2016 formula. Score 6-14 = low, 15-24 = intermediate, ≥25 = high mortality risk. Uncomputable if any required lab is missing.';
    }

    public function requiredComponents(): array
    {
        return ['liver_disease_diagnosis', 'bilirubin', 'inr', 'creatinine'];
    }

    public function riskTiers(): array
    {
        return [
            'low'          => [6,  15],
            'intermediate' => [15, 25],
            'high'         => [25, null],
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
                      AND co.condition_concept_id IN (4064161, 4245975, 196262, 194990)
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
            -- Latest INR: concept 3022217 (LOINC 6301-6)
            latest_inr AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS inr
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3022217
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- Latest creatinine (mg/dL): concept 3016723 (LOINC 2160-0)
            latest_creatinine AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS creatinine
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3016723
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            components AS (
                SELECT
                    lp.person_id,
                    bil.bilirubin,
                    inr.inr,
                    cr.creatinine,
                    -- Apply floor and cap values per UNOS formula
                    GREATEST(COALESCE(bil.bilirubin, NULL), 1.0)              AS bili_adj,
                    GREATEST(COALESCE(inr.inr, NULL), 1.0)                    AS inr_adj,
                    LEAST(GREATEST(COALESCE(cr.creatinine, NULL), 1.0), 4.0)  AS cr_adj,
                    -- Lab presence flags for confidence
                    CASE WHEN bil.bilirubin IS NOT NULL THEN 1 ELSE 0 END     AS bil_present,
                    CASE WHEN inr.inr       IS NOT NULL THEN 1 ELSE 0 END     AS inr_present,
                    CASE WHEN cr.creatinine IS NOT NULL THEN 1 ELSE 0 END     AS cr_present
                FROM liver_patients lp
                LEFT JOIN latest_bilirubin  bil ON lp.person_id = bil.person_id
                LEFT JOIN latest_inr        inr ON lp.person_id = inr.person_id
                LEFT JOIN latest_creatinine cr  ON lp.person_id = cr.person_id
            ),
            scored AS (
                SELECT
                    c.*,
                    -- MELD formula; NULL if any required lab is missing
                    CASE
                        WHEN bilirubin IS NULL OR inr IS NULL OR creatinine IS NULL THEN NULL
                        ELSE ROUND(
                            GREATEST(
                                LEAST(
                                    3.78 * LN(bili_adj) +
                                    11.2 * LN(inr_adj)  +
                                    9.57 * LN(cr_adj)   +
                                    6.43,
                                    40.0
                                ),
                                6.0
                            )
                        , 1)
                    END AS meld_score,
                    -- Confidence: fraction of 3 required labs available
                    ROUND((bil_present + inr_present + cr_present)::NUMERIC / 3, 4) AS confidence,
                    -- Completeness: same as confidence (all 3 are required)
                    ROUND((bil_present + inr_present + cr_present)::NUMERIC / 3, 4) AS completeness
                FROM components c
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN meld_score IS NULL THEN 'uncomputable'
                        WHEN meld_score >= 25   THEN 'high'
                        WHEN meld_score >= 15   THEN 'intermediate'
                        ELSE 'low'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM liver_patients)                                              AS total_eligible,
                ROUND(AVG(meld_score), 4)                                                          AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY meld_score)                           AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY meld_score)                           AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY meld_score)                           AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"bilirubin":'   || SUM(CASE WHEN bilirubin  IS NULL THEN 1 ELSE 0 END) ||
                ',"inr":'         || SUM(CASE WHEN inr        IS NULL THEN 1 ELSE 0 END) ||
                ',"creatinine":'  || SUM(CASE WHEN creatinine IS NULL THEN 1 ELSE 0 END) ||
                '}'                                                                                AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'  THEN 3 ELSE 4 END
            SQL;
    }
}
