<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS003 – CHA₂DS₂-VASc Score (Stroke Risk in Atrial Fibrillation)
 *
 * Clinical decision tool to estimate stroke risk in patients with
 * non-valvular atrial fibrillation (AF). Guides anticoagulation therapy.
 *
 * Point system:
 *   C  – Congestive Heart Failure    (concept 316139)              = 1
 *   H  – Hypertension                (concept 316866)              = 1
 *   A₂ – Age ≥ 75                                                  = 2
 *   D  – Diabetes mellitus           (concepts 201826,201254,443238) = 1
 *   S₂ – Prior stroke / TIA         (concepts 443454,4110192)      = 2
 *   V  – Vascular disease (MI/PAD)   (concepts 312327,4185932)     = 1
 *   A  – Age 65–74                                                 = 1
 *   Sc – Female sex                  (gender_concept_id = 8532)    = 1
 *
 * All components derive from structured CDM (person + condition_occurrence),
 * so confidence = 1.0 when AF is confirmed with age and sex available.
 *
 * OMOP standard concepts (SNOMED):
 *   313217  – Atrial fibrillation
 *   316139  – Heart failure
 *   316866  – Hypertensive disorder
 *   201826  – Type 2 diabetes mellitus
 *   201254  – Type 1 diabetes mellitus
 *   443238  – Diabetes mellitus
 *   443454  – Cerebrovascular accident
 *   4110192 – Transient ischemic attack
 *   312327  – Myocardial infarction
 *   4185932 – Peripheral arterial disease
 */
class RS003CHA2DS2VASc implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS003';
    }

    public function scoreName(): string
    {
        return 'CHA₂DS₂-VASc Score (Stroke Risk in AF)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with atrial fibrillation';
    }

    public function description(): string
    {
        return 'Estimates annual stroke risk in patients with non-valvular atrial fibrillation using the CHA₂DS₂-VASc point system. Score 0 (male) or 1 (female) = low; 1-2 = intermediate; ≥3 = high risk. Guides anticoagulation decisions per ESC/ACC/AHA guidelines.';
    }

    public function requiredComponents(): array
    {
        return [
            'af_diagnosis',
            'age',
            'sex',
            'heart_failure',
            'hypertension',
            'diabetes',
            'stroke_tia',
            'vascular_disease',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 2],
            'intermediate' => [1, 3],
            'high' => [3, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH af_patients AS (
                -- Eligible: patients with at least one atrial fibrillation diagnosis
                SELECT DISTINCT p.person_id,
                       p.gender_concept_id,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth, 7),
                               COALESCE(p.day_of_birth, 1))))::INT AS age
                FROM {@cdmSchema}.person p
                WHERE EXISTS (
                    SELECT 1 FROM {@cdmSchema}.condition_occurrence co
                    WHERE co.person_id = p.person_id
                      AND co.condition_concept_id = 313217
                )
                  AND p.gender_concept_id IN (8507, 8532)
            ),
            chf AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316139
            ),
            hypertension AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316866
            ),
            diabetes AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (201826, 201254, 443238)
            ),
            stroke_tia AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (443454, 4110192)
            ),
            vascular_disease AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (312327, 4185932)
            ),
            scored AS (
                SELECT
                    af.person_id,
                    af.gender_concept_id,
                    af.age,
                    -- C: Congestive Heart Failure
                    CASE WHEN chf.person_id     IS NOT NULL THEN 1 ELSE 0 END AS c_chf,
                    -- H: Hypertension
                    CASE WHEN htn.person_id     IS NOT NULL THEN 1 ELSE 0 END AS h_htn,
                    -- A2: Age >= 75 (2 pts)
                    CASE WHEN af.age >= 75      THEN 2 ELSE 0 END             AS a2_age75,
                    -- D: Diabetes
                    CASE WHEN dm.person_id      IS NOT NULL THEN 1 ELSE 0 END AS d_dm,
                    -- S2: Prior stroke / TIA (2 pts)
                    CASE WHEN st.person_id      IS NOT NULL THEN 2 ELSE 0 END AS s2_stroke,
                    -- V: Vascular disease (MI or PAD)
                    CASE WHEN vd.person_id      IS NOT NULL THEN 1 ELSE 0 END AS v_vasc,
                    -- A: Age 65-74 (1 pt; mutually exclusive with A2)
                    CASE WHEN af.age BETWEEN 65 AND 74 THEN 1 ELSE 0 END      AS a_age65,
                    -- Sc: Female sex
                    CASE WHEN af.gender_concept_id = 8532 THEN 1 ELSE 0 END  AS sc_female,
                    -- Confidence = 1.0 (all components from structured data)
                    1.0::NUMERIC AS confidence,
                    -- Completeness = 1.0 (no labs required)
                    1.0::NUMERIC AS completeness
                FROM af_patients af
                LEFT JOIN chf            chf ON af.person_id = chf.person_id
                LEFT JOIN hypertension   htn ON af.person_id = htn.person_id
                LEFT JOIN diabetes       dm  ON af.person_id = dm.person_id
                LEFT JOIN stroke_tia     st  ON af.person_id = st.person_id
                LEFT JOIN vascular_disease vd ON af.person_id = vd.person_id
            ),
            totals AS (
                SELECT *,
                    (c_chf + h_htn + a2_age75 + d_dm + s2_stroke + v_vasc + a_age65 + sc_female) AS cha2ds2_score
                FROM scored
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN cha2ds2_score >= 3 THEN 'high'
                        WHEN cha2ds2_score >= 1 THEN 'intermediate'
                        ELSE 'low'
                    END AS risk_tier
                FROM totals
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM af_patients)                                                 AS total_eligible,
                ROUND(AVG(cha2ds2_score), 4)                                                       AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY cha2ds2_score)                        AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY cha2ds2_score)                        AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY cha2ds2_score)                        AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"af_confirmed":' || SUM(CASE WHEN cha2ds2_score IS NULL THEN 1 ELSE 0 END) || '}' AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'  THEN 3 ELSE 4 END
            SQL;
    }
}
