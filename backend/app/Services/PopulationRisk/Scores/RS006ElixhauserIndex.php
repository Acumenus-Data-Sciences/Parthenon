<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS006 – Elixhauser Comorbidity Index (van Walraven 2009 weighted)
 *
 * The Elixhauser index uses 30 comorbidity categories with integer weights
 * (positive and negative) derived from van Walraven et al. (2009) to produce
 * a composite in-hospital mortality risk score.
 *
 * Van Walraven weights (positive favours mortality risk, negative is protective):
 *   CHF=7, Arrhythmia=5, Valvular=−1, PulmonaryCirculation=4, PVD=2,
 *   HTN_uncomplicated=0, HTN_complicated=0, Paralysis=7, OtherNeuro=6,
 *   COPD=3, DM_uncomplicated=0, DM_complicated=0, Hypothyroidism=0,
 *   RenalFailure=5, Liver=11, PUD=0, AIDS=0, Lymphoma=9, MetastaticCancer=12,
 *   SolidTumor=4, RA=0, Coagulopathy=3, Obesity=−4, WeightLoss=6,
 *   FluidElectrolyte=5, BloodLossAnemia=−2, DeficiencyAnemia=−2,
 *   AlcoholAbuse=0, DrugAbuse=−7, Psychosis=0, Depression=−3
 *
 * OMOP standard SNOMED concept IDs (representative; full concept sets
 * should be validated against institutional SNOMED hierarchy):
 *   CHF: 316139 | Arrhythmia: 313217,4068155 | Valvular: 4295615
 *   PulmonaryCirc: 440417 | PVD: 4185932 | HTN_unc: 316866
 *   Paralysis: 374022 | OtherNeuro: 372610 | COPD: 255573
 *   DM_unc: 201826,443238 | DM_comp: 443239 | Hypothyroid: 140673
 *   RenalFail: 443601 | Liver: 4064161,4245975 | PUD: 4209494
 *   AIDS: 439727 | Lymphoma: 4119980 | MetaCancer: 432851
 *   SolidTumor: 4178681 | RA: 80809 | Coagulopathy: 437312
 *   Obesity: 433736 | WeightLoss: 440377 | FluidElec: 4027663
 *   BloodLossAnemia: 439777 | DeficiencyAnemia: 441267
 *   Alcohol: 433753 | Drug: 440069 | Psychosis: 436073 | Depression: 440383
 *
 * Confidence = 0.8 baseline (absent conditions may be uncoded).
 * Completeness = 1.0 (all conditions; no labs required).
 *
 * Score tiers (van Walraven composite):
 *   negative  : score < 0
 *   low       : 0–4
 *   intermediate: 5–9
 *   high      : ≥10
 */
class RS006ElixhauserIndex implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS006';
    }

    public function scoreName(): string
    {
        return 'Elixhauser Comorbidity Index (van Walraven)';
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
        return 'Van Walraven 2009 weighted Elixhauser comorbidity score using 30 ICD-derived categories mapped to OMOP SNOMED concepts. Integer weights (−7 to +12) are summed. Composite score < 0 = negative/protective; 0-4 = low; 5-9 = intermediate; ≥10 = high in-hospital mortality risk.';
    }

    public function requiredComponents(): array
    {
        return ['condition_occurrence_records'];
    }

    public function riskTiers(): array
    {
        return [
            'negative' => [null, 0],
            'low' => [0,    5],
            'intermediate' => [5,   10],
            'high' => [10, null],
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
            -- 30 Elixhauser condition groups (DISTINCT per patient)
            e_chf AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316139
            ),
            e_arrhythmia AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (313217, 4068155)
            ),
            e_valvular AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4295615
            ),
            e_pulm_circ AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 440417
            ),
            e_pvd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4185932
            ),
            e_htn_unc AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 316866
            ),
            e_paralysis AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 374022
            ),
            e_other_neuro AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 372610
            ),
            e_copd AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 255573
            ),
            e_dm_unc AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (201826, 443238)
            ),
            e_dm_comp AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443239
            ),
            e_hypothyroid AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 140673
            ),
            e_renal AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 443601
            ),
            e_liver AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id IN (4064161, 4245975)
            ),
            e_pud AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4209494
            ),
            e_aids AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 439727
            ),
            e_lymphoma AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4119980
            ),
            e_meta_cancer AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 432851
            ),
            e_solid_tumor AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4178681
            ),
            e_ra AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 80809
            ),
            e_coagulopathy AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 437312
            ),
            e_obesity AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 433736
            ),
            e_weight_loss AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 440377
            ),
            e_fluid_elec AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 4027663
            ),
            e_blood_loss_anemia AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 439777
            ),
            e_def_anemia AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 441267
            ),
            e_alcohol AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 433753
            ),
            e_drug AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 440069
            ),
            e_psychosis AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 436073
            ),
            e_depression AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 440383
            ),
            scored AS (
                SELECT
                    el.person_id,
                    -- Van Walraven weights applied per condition flag
                    (
                     CASE WHEN chf.person_id      IS NOT NULL THEN  7 ELSE 0 END +  -- CHF
                     CASE WHEN arr.person_id      IS NOT NULL THEN  5 ELSE 0 END +  -- Arrhythmia
                     CASE WHEN val.person_id      IS NOT NULL THEN -1 ELSE 0 END +  -- Valvular
                     CASE WHEN pcirc.person_id    IS NOT NULL THEN  4 ELSE 0 END +  -- PulmonaryCirc
                     CASE WHEN pvd.person_id      IS NOT NULL THEN  2 ELSE 0 END +  -- PVD
                     CASE WHEN htn.person_id      IS NOT NULL THEN  0 ELSE 0 END +  -- HTN_unc (0)
                     CASE WHEN par.person_id      IS NOT NULL THEN  7 ELSE 0 END +  -- Paralysis
                     CASE WHEN neuro.person_id    IS NOT NULL THEN  6 ELSE 0 END +  -- OtherNeuro
                     CASE WHEN copd.person_id     IS NOT NULL THEN  3 ELSE 0 END +  -- COPD
                     CASE WHEN dmu.person_id      IS NOT NULL THEN  0 ELSE 0 END +  -- DM_unc (0)
                     CASE WHEN dmc.person_id      IS NOT NULL THEN  0 ELSE 0 END +  -- DM_comp (0)
                     CASE WHEN hypo.person_id     IS NOT NULL THEN  0 ELSE 0 END +  -- Hypothyroid (0)
                     CASE WHEN ren.person_id      IS NOT NULL THEN  5 ELSE 0 END +  -- RenalFail
                     CASE WHEN liv.person_id      IS NOT NULL THEN 11 ELSE 0 END +  -- Liver
                     CASE WHEN pud.person_id      IS NOT NULL THEN  0 ELSE 0 END +  -- PUD (0)
                     CASE WHEN aids.person_id     IS NOT NULL THEN  0 ELSE 0 END +  -- AIDS (0)
                     CASE WHEN lym.person_id      IS NOT NULL THEN  9 ELSE 0 END +  -- Lymphoma
                     CASE WHEN meta.person_id     IS NOT NULL THEN 12 ELSE 0 END +  -- MetastaticCancer
                     CASE WHEN solid.person_id    IS NOT NULL THEN  4 ELSE 0 END +  -- SolidTumor
                     CASE WHEN ra.person_id       IS NOT NULL THEN  0 ELSE 0 END +  -- RA (0)
                     CASE WHEN coag.person_id     IS NOT NULL THEN  3 ELSE 0 END +  -- Coagulopathy
                     CASE WHEN obese.person_id    IS NOT NULL THEN -4 ELSE 0 END +  -- Obesity
                     CASE WHEN wtloss.person_id   IS NOT NULL THEN  6 ELSE 0 END +  -- WeightLoss
                     CASE WHEN fluid.person_id    IS NOT NULL THEN  5 ELSE 0 END +  -- FluidElec
                     CASE WHEN bla.person_id      IS NOT NULL THEN -2 ELSE 0 END +  -- BloodLossAnemia
                     CASE WHEN dana.person_id     IS NOT NULL THEN -2 ELSE 0 END +  -- DefAnemia
                     CASE WHEN alc.person_id      IS NOT NULL THEN  0 ELSE 0 END +  -- Alcohol (0)
                     CASE WHEN drug.person_id     IS NOT NULL THEN -7 ELSE 0 END +  -- DrugAbuse
                     CASE WHEN psych.person_id    IS NOT NULL THEN  0 ELSE 0 END +  -- Psychosis (0)
                     CASE WHEN dep.person_id      IS NOT NULL THEN -3 ELSE 0 END    -- Depression
                    )                                                                AS elixhauser_score,
                    0.8::NUMERIC AS confidence,
                    1.0::NUMERIC AS completeness
                FROM eligible el
                LEFT JOIN e_chf              chf    ON el.person_id = chf.person_id
                LEFT JOIN e_arrhythmia       arr    ON el.person_id = arr.person_id
                LEFT JOIN e_valvular         val    ON el.person_id = val.person_id
                LEFT JOIN e_pulm_circ        pcirc  ON el.person_id = pcirc.person_id
                LEFT JOIN e_pvd              pvd    ON el.person_id = pvd.person_id
                LEFT JOIN e_htn_unc          htn    ON el.person_id = htn.person_id
                LEFT JOIN e_paralysis        par    ON el.person_id = par.person_id
                LEFT JOIN e_other_neuro      neuro  ON el.person_id = neuro.person_id
                LEFT JOIN e_copd             copd   ON el.person_id = copd.person_id
                LEFT JOIN e_dm_unc           dmu    ON el.person_id = dmu.person_id
                LEFT JOIN e_dm_comp          dmc    ON el.person_id = dmc.person_id
                LEFT JOIN e_hypothyroid      hypo   ON el.person_id = hypo.person_id
                LEFT JOIN e_renal            ren    ON el.person_id = ren.person_id
                LEFT JOIN e_liver            liv    ON el.person_id = liv.person_id
                LEFT JOIN e_pud              pud    ON el.person_id = pud.person_id
                LEFT JOIN e_aids             aids   ON el.person_id = aids.person_id
                LEFT JOIN e_lymphoma         lym    ON el.person_id = lym.person_id
                LEFT JOIN e_meta_cancer      meta   ON el.person_id = meta.person_id
                LEFT JOIN e_solid_tumor      solid  ON el.person_id = solid.person_id
                LEFT JOIN e_ra               ra     ON el.person_id = ra.person_id
                LEFT JOIN e_coagulopathy     coag   ON el.person_id = coag.person_id
                LEFT JOIN e_obesity          obese  ON el.person_id = obese.person_id
                LEFT JOIN e_weight_loss      wtloss ON el.person_id = wtloss.person_id
                LEFT JOIN e_fluid_elec       fluid  ON el.person_id = fluid.person_id
                LEFT JOIN e_blood_loss_anemia bla   ON el.person_id = bla.person_id
                LEFT JOIN e_def_anemia       dana   ON el.person_id = dana.person_id
                LEFT JOIN e_alcohol          alc    ON el.person_id = alc.person_id
                LEFT JOIN e_drug             drug   ON el.person_id = drug.person_id
                LEFT JOIN e_psychosis        psych  ON el.person_id = psych.person_id
                LEFT JOIN e_depression       dep    ON el.person_id = dep.person_id
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN elixhauser_score >= 10 THEN 'high'
                        WHEN elixhauser_score >=  5 THEN 'intermediate'
                        WHEN elixhauser_score >=  0 THEN 'low'
                        ELSE 'negative'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                           AS patient_count,
                (SELECT COUNT(*) FROM eligible)                                                    AS total_eligible,
                ROUND(AVG(elixhauser_score), 4)                                                    AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY elixhauser_score)                     AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY elixhauser_score)                     AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY elixhauser_score)                     AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                 AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                               AS mean_completeness,
                '{"condition_occurrence_records":0}'                                               AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'  THEN 3 WHEN 'negative' THEN 4 ELSE 5 END
            SQL;
    }
}
