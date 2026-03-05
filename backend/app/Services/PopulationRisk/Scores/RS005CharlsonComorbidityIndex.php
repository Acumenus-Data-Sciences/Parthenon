<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS005 – Charlson Comorbidity Index (CCI)
 *
 * Weighted comorbidity score predicting 10-year mortality risk.
 * Uses the Quan 2005 SNOMED-adapted coding algorithm applied to OMOP
 * condition_occurrence. 10-year mortality approximation: e^(0.9 × CCI).
 *
 * Weighted condition groups (OMOP standard SNOMED concept IDs):
 *
 * Weight 1:
 *   MI (Myocardial infarction)       : 312327
 *   CHF (Congestive heart failure)   : 316139
 *   PVD (Peripheral vascular disease): 4185932
 *   CVD (Cerebrovascular disease)    : 4043838
 *   Dementia                         : 372610
 *   COPD                             : 255573
 *   Rheumatic disease                : 80809
 *   Peptic ulcer disease             : 4209494
 *   Mild liver disease (cirrhosis)   : 4064161
 *   Diabetes without CC              : 201826, 201254, 443238
 *
 * Weight 2:
 *   Diabetes with CC                 : 443239
 *   Hemiplegia / paraplegia          : 374022
 *   Renal disease                    : 443601
 *   Any malignancy (solid)           : 4178681
 *
 * Weight 3:
 *   Moderate/severe liver disease    : 4245975
 *
 * Weight 6:
 *   Metastatic solid tumor           : 432851
 *   AIDS / HIV                       : 439727
 *
 * Confidence = 0.8 baseline (absent conditions may be truly absent OR uncoded).
 * Completeness = 1.0 (all components from condition_occurrence; no labs needed).
 */
class RS005CharlsonComorbidityIndex implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS005';
    }

    public function scoreName(): string
    {
        return 'Charlson Comorbidity Index (CCI)';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients with any condition record';
    }

    public function description(): string
    {
        return 'Weighted comorbidity score (Quan 2005 SNOMED adaptation) predicting 10-year mortality. Conditions are weighted 1-6 and summed. 10-year mortality ≈ e^(0.9 × CCI). Tiers: low (0-2), moderate (3-4), high (5), very high (≥6).';
    }

    public function requiredComponents(): array
    {
        return ['condition_occurrence_records'];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 3],
            'moderate' => [3, 5],
            'high' => [5, 7],
            'very_high' => [7, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'person'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH eligible AS (
                -- All patients with at least one condition record
                SELECT DISTINCT p.person_id
                FROM {@cdmSchema}.person p
                WHERE EXISTS (
                    SELECT 1 FROM {@cdmSchema}.condition_occurrence co
                    WHERE co.person_id = p.person_id
                )
            ),
            -- Weight-1 conditions (one EXISTS per group per patient)
            w1_mi AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 312327
            ),
            w1_chf AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316139
            ),
            w1_pvd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4185932
            ),
            w1_cvd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4043838
            ),
            w1_dementia AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 372610
            ),
            w1_copd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 255573
            ),
            w1_rheum AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 80809
            ),
            w1_pud AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4209494
            ),
            w1_mild_liver AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4064161
            ),
            w1_dm AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (201826, 201254, 443238)
            ),
            -- Weight-2 conditions
            w2_dm_cc AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443239
            ),
            w2_hemi AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 374022
            ),
            w2_renal AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443601
            ),
            w2_malignancy AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4178681
            ),
            -- Weight-3 conditions
            w3_mod_liver AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4245975
            ),
            -- Weight-6 conditions
            w6_metastatic AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 432851
            ),
            w6_aids AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 439727
            ),
            scored AS (
                SELECT
                    e.person_id,
                    -- Weight 1 conditions
                    (CASE WHEN mi.person_id    IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN chf.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN pvd.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN cvd.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN dem.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN copd.person_id  IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN rhm.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     CASE WHEN pud.person_id   IS NOT NULL THEN 1 ELSE 0 END +
                     -- Liver: mild (w1) superseded by moderate (w3); apply only if mod_liver absent
                     CASE WHEN mliv.person_id  IS NOT NULL
                           AND modliv.person_id IS NULL     THEN 1 ELSE 0 END +
                     -- DM without CC superseded by DM with CC
                     CASE WHEN dm.person_id    IS NOT NULL
                           AND dmcc.person_id  IS NULL      THEN 1 ELSE 0 END +
                     -- Weight 2 conditions
                     CASE WHEN dmcc.person_id  IS NOT NULL THEN 2 ELSE 0 END +
                     CASE WHEN hemi.person_id  IS NOT NULL THEN 2 ELSE 0 END +
                     CASE WHEN renal.person_id IS NOT NULL THEN 2 ELSE 0 END +
                     -- Malignancy weight 2 (superseded by metastatic w6)
                     CASE WHEN malig.person_id IS NOT NULL
                           AND meta.person_id  IS NULL      THEN 2 ELSE 0 END +
                     -- Weight 3 conditions
                     CASE WHEN modliv.person_id IS NOT NULL THEN 3 ELSE 0 END +
                     -- Weight 6 conditions
                     CASE WHEN meta.person_id  IS NOT NULL THEN 6 ELSE 0 END +
                     CASE WHEN aids.person_id  IS NOT NULL THEN 6 ELSE 0 END
                    )                                                             AS cci_score,
                    -- Confidence: 0.8 baseline (absent = truly absent OR uncoded)
                    0.8::NUMERIC AS confidence,
                    -- Completeness: 1.0 — no labs required
                    1.0::NUMERIC AS completeness
                FROM eligible e
                LEFT JOIN w1_mi         mi     ON e.person_id = mi.person_id
                LEFT JOIN w1_chf        chf    ON e.person_id = chf.person_id
                LEFT JOIN w1_pvd        pvd    ON e.person_id = pvd.person_id
                LEFT JOIN w1_cvd        cvd    ON e.person_id = cvd.person_id
                LEFT JOIN w1_dementia   dem    ON e.person_id = dem.person_id
                LEFT JOIN w1_copd       copd   ON e.person_id = copd.person_id
                LEFT JOIN w1_rheum      rhm    ON e.person_id = rhm.person_id
                LEFT JOIN w1_pud        pud    ON e.person_id = pud.person_id
                LEFT JOIN w1_mild_liver mliv   ON e.person_id = mliv.person_id
                LEFT JOIN w1_dm         dm     ON e.person_id = dm.person_id
                LEFT JOIN w2_dm_cc      dmcc   ON e.person_id = dmcc.person_id
                LEFT JOIN w2_hemi       hemi   ON e.person_id = hemi.person_id
                LEFT JOIN w2_renal      renal  ON e.person_id = renal.person_id
                LEFT JOIN w2_malignancy malig  ON e.person_id = malig.person_id
                LEFT JOIN w3_mod_liver  modliv ON e.person_id = modliv.person_id
                LEFT JOIN w6_metastatic meta   ON e.person_id = meta.person_id
                LEFT JOIN w6_aids       aids   ON e.person_id = aids.person_id
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN cci_score >= 7 THEN 'very_high'
                        WHEN cci_score >= 5 THEN 'high'
                        WHEN cci_score >= 3 THEN 'moderate'
                        ELSE 'low'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM eligible)                                                    AS total_eligible,
                ROUND(AVG(cci_score), 4)                                                           AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY cci_score)                            AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY cci_score)                            AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY cci_score)                            AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"condition_occurrence_records":0}'                                               AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'very_high' THEN 1 WHEN 'high' THEN 2
                                    WHEN 'moderate'  THEN 3 WHEN 'low'  THEN 4 ELSE 5 END
            SQL;
    }
}
