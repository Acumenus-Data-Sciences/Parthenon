<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS009 – Revised Cardiac Risk Index (Lee 1999)
 *
 * Estimates perioperative major cardiac event (MACE) risk in patients
 * undergoing non-cardiac surgery. Six binary risk factors, each = 1 point.
 * Original validation cohort: 2893 patients ≥50 undergoing elective non-cardiac surgery.
 *
 * Risk factors (each = 1 point):
 *   1. High-risk surgery — approximated via procedure_occurrence surgical procedures
 *      (intraperitoneal, intrathoracic, or suprainguinal vascular surgery).
 *      OMOP procedure domain: broad surgical concepts; use preoperative assessment
 *      condition (4304368) as a proxy flag when procedure data is sparse.
 *   2. Ischemic heart disease — MI (312327), angina (315286), CABG (4180790)
 *   3. Congestive heart failure — (316139)
 *   4. Cerebrovascular disease — stroke (443454), TIA (4110192)
 *   5. Insulin-dependent diabetes — DM (443238) + insulin drug exposure
 *      (ingredient concept 1516766 via concept_ancestor)
 *   6. Renal insufficiency — creatinine > 2.0 mg/dL (concept 3016723)
 *
 * RCRI score 0 → very_low (~0.4% MACE), 1 → low (~0.9%), 2 → intermediate (~6.6%),
 * ≥3 → high (~11% MACE risk).
 *
 * Confidence:
 *   5 condition/demographic items always derivable + creatinine lab.
 *   confidence = (5 + CASE WHEN creatinine IS NOT NULL THEN 1 ELSE 0 END) / 6
 *
 * OMOP concepts:
 *   4304368 – Preoperative assessment
 *   312327  – Myocardial infarction
 *   315286  – Angina pectoris
 *   4180790 – Coronary artery bypass grafting
 *   316139  – Congestive heart failure
 *   443454  – Cerebrovascular accident (stroke)
 *   4110192 – Transient ischemic attack
 *   443238  – Diabetes mellitus
 *   1516766 – Insulin (ingredient)
 *   3016723 – Creatinine [Mass/vol] in Serum or Plasma (LOINC 2160-0)
 */
class RS009RevisedCardiacRiskIndex implements PopulationRiskScoreInterface
{
    public function scoreId(): string       { return 'RS009'; }
    public function scoreName(): string     { return 'Revised Cardiac Risk Index (RCRI)'; }
    public function category(): string      { return 'Cardiovascular'; }
    public function eligiblePopulation(): string { return 'Patients ≥18 with any surgical history or preoperative assessment'; }

    public function description(): string
    {
        return 'Lee 1999 Revised Cardiac Risk Index for perioperative major adverse cardiac event (MACE) risk stratification. Six binary risk factors scored 0-6. Very low (0) ≈0.4%, low (1) ≈0.9%, intermediate (2) ≈6.6%, high (≥3) ≈11% MACE risk. Widely used in preoperative cardiac evaluation per ACC/AHA guidelines.';
    }

    public function requiredComponents(): array
    {
        return [
            'ischemic_heart_disease',
            'heart_failure',
            'cerebrovascular_disease',
            'insulin_dependent_diabetes',
            'renal_insufficiency',
            'high_risk_surgery',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'very_low'     => [0, 1],
            'low'          => [1, 2],
            'intermediate' => [2, 3],
            'high'         => [3, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'procedure_occurrence', 'measurement', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH eligible AS (
                -- Eligible: patients ≥18 with a surgical procedure or preoperative assessment
                SELECT DISTINCT p.person_id,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth, 7),
                               COALESCE(p.day_of_birth, 1))))::INT AS age
                FROM {@cdmSchema}.person p
                WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                          MAKE_DATE(p.year_of_birth,
                              COALESCE(p.month_of_birth, 7),
                              COALESCE(p.day_of_birth, 1)))) >= 18
                  AND (
                      -- Preoperative assessment or any procedure record
                      EXISTS (
                          SELECT 1 FROM {@cdmSchema}.condition_occurrence co
                          WHERE co.person_id = p.person_id
                            AND co.condition_concept_id = 4304368
                      )
                      OR EXISTS (
                          SELECT 1 FROM {@cdmSchema}.procedure_occurrence po
                          WHERE po.person_id = p.person_id
                            AND po.procedure_concept_id != 0
                      )
                  )
            ),
            -- Factor 1: High-risk surgery
            -- Major intraperitoneal/intrathoracic/suprainguinal vascular procedures.
            -- Approximated by: any major surgical procedure domain concept (domain_id = 'Procedure')
            -- with procedure_type indicating inpatient operating room, OR preoperative dx.
            -- Using a broad set of inpatient surgical procedure concept IDs is institution-specific;
            -- here we proxy via preoperative assessment condition + any OR procedure record.
            high_risk_surgery AS (
                SELECT DISTINCT po.person_id
                FROM {@cdmSchema}.procedure_occurrence po
                WHERE po.procedure_concept_id IN (
                    -- Abdominal surgery (laparotomy)
                    4164616,
                    -- Thoracic surgery (thoracotomy)
                    4072634,
                    -- Major vascular surgery (aortic aneurysm repair, vascular bypass)
                    4336468, 4337638,
                    -- Hip/femoral procedures (major orthopaedic)
                    4143316,
                    -- Preoperative assessment code (condition used as proxy if no proc)
                    4304368
                )
                UNION
                SELECT DISTINCT co.person_id
                FROM {@cdmSchema}.condition_occurrence co
                WHERE co.condition_concept_id = 4304368
            ),
            -- Factor 2: Ischemic heart disease
            ischemic_hd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (312327, 315286, 4180790)
            ),
            -- Factor 3: Congestive heart failure
            chf AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316139
            ),
            -- Factor 4: Cerebrovascular disease
            cerebrovascular AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (443454, 4110192)
            ),
            -- Factor 5: Insulin-dependent diabetes (DM diagnosis + insulin exposure)
            dm_patients AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443238
            ),
            insulin_patients AS (
                SELECT DISTINCT de.person_id
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                  ON de.drug_concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id = 1516766  -- Insulin ingredient
                  AND de.drug_concept_id != 0
            ),
            -- Factor 6: Renal insufficiency (creatinine > 2.0 mg/dL)
            latest_creatinine AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS creatinine
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3016723
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            components AS (
                SELECT
                    e.person_id,
                    e.age,
                    -- Factor 1: High-risk surgery
                    CASE WHEN hrs.person_id IS NOT NULL THEN 1 ELSE 0 END      AS f1_surgery,
                    -- Factor 2: Ischemic heart disease
                    CASE WHEN ihd.person_id IS NOT NULL THEN 1 ELSE 0 END      AS f2_ihd,
                    -- Factor 3: CHF
                    CASE WHEN chf.person_id IS NOT NULL THEN 1 ELSE 0 END      AS f3_chf,
                    -- Factor 4: Cerebrovascular disease
                    CASE WHEN cv.person_id  IS NOT NULL THEN 1 ELSE 0 END      AS f4_cv,
                    -- Factor 5: Insulin-dependent DM (both DM dx AND insulin rx)
                    CASE WHEN dm.person_id  IS NOT NULL
                          AND ins.person_id IS NOT NULL THEN 1 ELSE 0 END      AS f5_iddm,
                    -- Factor 6: Creatinine > 2.0 mg/dL
                    CASE WHEN cr.creatinine > 2.0       THEN 1 ELSE 0 END      AS f6_renal,
                    cr.creatinine
                FROM eligible e
                LEFT JOIN high_risk_surgery  hrs ON e.person_id = hrs.person_id
                LEFT JOIN ischemic_hd        ihd ON e.person_id = ihd.person_id
                LEFT JOIN chf                chf ON e.person_id = chf.person_id
                LEFT JOIN cerebrovascular    cv  ON e.person_id = cv.person_id
                LEFT JOIN dm_patients        dm  ON e.person_id = dm.person_id
                LEFT JOIN insulin_patients   ins ON e.person_id = ins.person_id
                LEFT JOIN latest_creatinine  cr  ON e.person_id = cr.person_id
            ),
            scored AS (
                SELECT *,
                    (f1_surgery + f2_ihd + f3_chf + f4_cv + f5_iddm + f6_renal) AS rcri_score,
                    -- Confidence: 5 condition items always present + creatinine lab
                    ROUND((5 + CASE WHEN creatinine IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / 6, 4) AS confidence,
                    ROUND((5 + CASE WHEN creatinine IS NOT NULL THEN 1 ELSE 0 END)::NUMERIC / 6, 4) AS completeness
                FROM components
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN rcri_score >= 3 THEN 'high'
                        WHEN rcri_score  = 2 THEN 'intermediate'
                        WHEN rcri_score  = 1 THEN 'low'
                        ELSE 'very_low'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM eligible)                                                    AS total_eligible,
                ROUND(AVG(rcri_score), 4)                                                          AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY rcri_score)                           AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY rcri_score)                           AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY rcri_score)                           AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"creatinine":' || SUM(CASE WHEN creatinine IS NULL THEN 1 ELSE 0 END) || '}' AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'  THEN 3 WHEN 'very_low' THEN 4 ELSE 5 END
            SQL;
    }
}
