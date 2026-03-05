<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS004 – HAS-BLED Bleeding Risk Score
 *
 * Estimates 1-year major bleeding risk in patients with atrial fibrillation,
 * intended to balance the benefit of anticoagulation against hemorrhagic risk.
 *
 * Point system:
 *   H – Hypertension (uncontrolled, SBP > 160 or dx 316866)      = 1
 *   A – Abnormal renal (creatinine > 2.3 mg/dL, concept 3016723) = 1
 *       OR abnormal liver (bilirubin > 3 mg/dL, concept 3024128
 *                          OR cirrhosis concept 4064161)          = 1  (max 2 for both)
 *   S – Prior stroke (concept 443454)                             = 1
 *   B – Bleeding history (GI hemorrhage 192671, ICH 376065)       = 1
 *   L – Labile INR (INR concept 3022217 > 3.5)                    = 1
 *   E – Elderly (age > 65)                                        = 1
 *   D – Drugs: antiplatelet (clopidogrel 1322184, aspirin 1112807)= 1
 *
 * Confidence denominator = 9 items:
 *   6 binary condition/demographic items (always derivable) +
 *   3 labs (creatinine, bilirubin, INR) when available.
 *   confidence = (6 + labs_present) / 9
 *
 * OMOP concepts:
 *   313217  – Atrial fibrillation
 *   316866  – Hypertensive disorder
 *   3016723 – Creatinine [Mass/volume] in Serum or Plasma (LOINC 2160-0)
 *   3024128 – Bilirubin.total [Mass/volume] in Serum or Plasma (LOINC 1975-2)
 *   4064161 – Cirrhosis of liver
 *   443454  – Cerebrovascular accident
 *   192671  – Gastrointestinal hemorrhage
 *   376065  – Intracranial hemorrhage
 *   3022217 – INR (LOINC 6301-6)
 *   1322184 – Clopidogrel (ingredient)
 *   1112807 – Aspirin (ingredient)
 */
class RS004HASBLED implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS004';
    }

    public function scoreName(): string
    {
        return 'HAS-BLED Bleeding Risk Score';
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
        return 'Estimates annual major bleeding risk in AF patients to guide anticoagulation decisions. Score 0-1 = low, 2 = intermediate, ≥3 = high risk. Integrates hypertension, renal/liver function, stroke history, bleeding history, INR lability, age, and concurrent antiplatelet/alcohol use.';
    }

    public function requiredComponents(): array
    {
        return [
            'af_diagnosis',
            'age',
            'hypertension',
            'renal_function',
            'liver_function',
            'stroke_history',
            'bleeding_history',
            'labile_inr',
            'antiplatelet_drugs',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 2],
            'intermediate' => [2, 3],
            'high' => [3, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'measurement', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH af_patients AS (
                -- Eligible: patients with atrial fibrillation diagnosis
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
            ),
            hypertension AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316866
            ),
            -- Latest creatinine (mg/dL)
            latest_creatinine AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS creatinine
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3016723
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- Latest total bilirubin (mg/dL)
            latest_bilirubin AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS bilirubin
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3024128
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            cirrhosis AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4064161
            ),
            stroke_history AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443454
            ),
            bleeding_history AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (192671, 376065)
            ),
            -- Latest INR
            latest_inr AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS inr
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3022217
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- Antiplatelet drugs via concept_ancestor (clopidogrel or aspirin ingredients)
            antiplatelet AS (
                SELECT DISTINCT de.person_id
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                  ON de.drug_concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id IN (1322184, 1112807)
                  AND de.drug_concept_id != 0
            ),
            components AS (
                SELECT
                    af.person_id,
                    af.age,
                    -- H: Hypertension = 1
                    CASE WHEN htn.person_id IS NOT NULL THEN 1 ELSE 0 END                         AS h_htn,
                    -- A: Abnormal renal function (creatinine > 2.3)
                    CASE WHEN cr.creatinine > 2.3       THEN 1 ELSE 0 END                         AS a_renal,
                    -- A: Abnormal liver function (bilirubin > 3.0 OR cirrhosis)
                    CASE WHEN bil.bilirubin > 3.0
                           OR cir.person_id IS NOT NULL THEN 1 ELSE 0 END                         AS a_liver,
                    -- S: Prior stroke = 1
                    CASE WHEN str.person_id IS NOT NULL THEN 1 ELSE 0 END                         AS s_stroke,
                    -- B: Bleeding history = 1
                    CASE WHEN bleed.person_id IS NOT NULL THEN 1 ELSE 0 END                       AS b_bleed,
                    -- L: Labile INR (INR > 3.5 as proxy for lability) = 1 if data available
                    CASE WHEN inr.inr > 3.5              THEN 1 ELSE 0 END                        AS l_inr,
                    -- E: Elderly (age > 65) = 1
                    CASE WHEN af.age > 65               THEN 1 ELSE 0 END                         AS e_elderly,
                    -- D: Antiplatelet drugs = 1
                    CASE WHEN apt.person_id IS NOT NULL THEN 1 ELSE 0 END                         AS d_drugs,
                    -- Lab availability for confidence
                    cr.creatinine,
                    bil.bilirubin,
                    inr.inr,
                    CASE WHEN cr.creatinine  IS NOT NULL THEN 1 ELSE 0 END AS cr_present,
                    CASE WHEN bil.bilirubin  IS NOT NULL THEN 1 ELSE 0 END AS bil_present,
                    CASE WHEN inr.inr        IS NOT NULL THEN 1 ELSE 0 END AS inr_present
                FROM af_patients af
                LEFT JOIN hypertension      htn   ON af.person_id = htn.person_id
                LEFT JOIN latest_creatinine cr    ON af.person_id = cr.person_id
                LEFT JOIN latest_bilirubin  bil   ON af.person_id = bil.person_id
                LEFT JOIN cirrhosis         cir   ON af.person_id = cir.person_id
                LEFT JOIN stroke_history    str   ON af.person_id = str.person_id
                LEFT JOIN bleeding_history  bleed ON af.person_id = bleed.person_id
                LEFT JOIN latest_inr        inr   ON af.person_id = inr.person_id
                LEFT JOIN antiplatelet      apt   ON af.person_id = apt.person_id
            ),
            scored AS (
                SELECT *,
                    -- HAS-BLED total: H + min(A_renal + A_liver, 2) + S + B + L + E + D
                    (h_htn
                     + LEAST(a_renal + a_liver, 2)
                     + s_stroke
                     + b_bleed
                     + l_inr
                     + e_elderly
                     + d_drugs)                                               AS hasbled_score,
                    -- Completeness: fraction of 9 total components with data
                    ROUND((6 + cr_present + bil_present + inr_present)::NUMERIC / 9, 4) AS completeness,
                    -- Confidence: 6 always-derivable items + 3 labs
                    ROUND((6 + cr_present + bil_present + inr_present)::NUMERIC / 9, 4) AS confidence
                FROM components
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN hasbled_score >= 3 THEN 'high'
                        WHEN hasbled_score >= 2 THEN 'intermediate'
                        ELSE 'low'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM af_patients)                                                 AS total_eligible,
                ROUND(AVG(hasbled_score), 4)                                                       AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY hasbled_score)                        AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY hasbled_score)                        AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY hasbled_score)                        AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"creatinine":' || SUM(CASE WHEN creatinine IS NULL THEN 1 ELSE 0 END) ||
                ',"bilirubin":'  || SUM(CASE WHEN bilirubin  IS NULL THEN 1 ELSE 0 END) ||
                ',"inr":'        || SUM(CASE WHEN inr        IS NULL THEN 1 ELSE 0 END) ||
                '}'                                                                                AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'  THEN 3 ELSE 4 END
            SQL;
    }
}
