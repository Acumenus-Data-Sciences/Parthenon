<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC004 – Drug-Drug Interaction Prevalence
 *
 * Identifies concurrent prescriptions of known high-risk drug pairs.
 * Exposure overlap is defined as any period where both drugs are active
 * simultaneously (start_a <= end_b AND end_a >= start_b).
 *
 * Ingredient concept IDs are standard RxNorm OMOP values:
 *   1310149 Warfarin  | 1309944 Amiodarone  | 1539403 Simvastatin
 *   1545958 Atorvastatin | 1503297 Metformin | 1307788 Digoxin
 *   740275  Lithium   | 715939  Sertraline  | 735979  Tramadol
 *   1322184 Clopidogrel | 923645 Omeprazole | 1742253 Fluconazole
 *   1706903 Metronidazole | 1734104 Clarithromycin | 1177480 Ibuprofen
 */
class CC004DrugDrugInteraction implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'CC004';
    }

    public function analysisName(): string
    {
        return 'Drug-Drug Interaction Prevalence';
    }

    public function category(): string
    {
        return 'Drug Safety';
    }

    public function description(): string
    {
        return 'Counts patients with concurrent exposure to known high-risk drug pairs (major DDIs). Uses concept_ancestor to capture all formulations of each ingredient.';
    }

    public function severity(): string
    {
        return 'critical';
    }

    public function flagThreshold(): ?float
    {
        return null;
    } // flag any concurrent DDI pair

    public function requiredTables(): array
    {
        return ['drug_exposure', 'concept', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH target_ingredients AS (
                SELECT ingredient_id, ingredient_name, pair_id, partner_id, partner_name, ddi_severity
                FROM (VALUES
                    -- (ingredient_id, ingredient_name, pair_id, partner_id, partner_name, severity)
                    (1310149, 'Warfarin',       1, 1309944, 'Amiodarone',      'Major'),
                    (1310149, 'Warfarin',       2, 1706903, 'Metronidazole',   'Major'),
                    (1310149, 'Warfarin',       3, 1742253, 'Fluconazole',     'Major'),
                    (1539403, 'Simvastatin',    4, 1309944, 'Amiodarone',      'Major'),
                    (1539403, 'Simvastatin',    5, 1734104, 'Clarithromycin',  'Major'),
                    (1545958, 'Atorvastatin',   6, 1734104, 'Clarithromycin',  'Major'),
                    (1307788, 'Digoxin',        7, 1309944, 'Amiodarone',      'Major'),
                    (740275,  'Lithium',        8, 1177480, 'Ibuprofen',       'Major'),
                    (715939,  'Sertraline',     9, 735979,  'Tramadol',        'Major'),
                    (1322184, 'Clopidogrel',   10, 923645,  'Omeprazole',      'Moderate'),
                    (1503297, 'Metformin',     11, 1177480, 'Ibuprofen',       'Moderate')
                ) AS t(ingredient_id, ingredient_name, pair_id, partner_id, partner_name, ddi_severity)
            ),
            ingredient_exposures AS (
                SELECT
                    de.person_id,
                    ca.ancestor_concept_id                                                  AS ingredient_id,
                    de.drug_exposure_start_date                                             AS start_dt,
                    COALESCE(
                        de.drug_exposure_end_date,
                        de.drug_exposure_start_date + INTERVAL '30 days'
                    )                                                                       AS end_dt
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                    ON de.drug_concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id IN (
                    1310149, 1309944, 1539403, 1545958, 1503297,
                    1307788, 740275,  715939,  735979,  1322184,
                    923645,  1742253, 1706903, 1734104, 1177480
                )
                AND de.drug_concept_id != 0
            ),
            concurrent_pairs AS (
                SELECT
                    ti.pair_id,
                    ti.ingredient_name                                                      AS drug_a,
                    ti.partner_name                                                         AS drug_b,
                    ti.ddi_severity,
                    COUNT(DISTINCT a.person_id)                                             AS concurrent_patients
                FROM target_ingredients ti
                JOIN ingredient_exposures a  ON a.ingredient_id = ti.ingredient_id
                JOIN ingredient_exposures b
                    ON b.person_id      = a.person_id
                    AND b.ingredient_id = ti.partner_id
                    AND a.start_dt      <= b.end_dt
                    AND a.end_dt        >= b.start_dt
                GROUP BY ti.pair_id, ti.ingredient_name, ti.partner_name, ti.ddi_severity
            )
            SELECT
                cp.ddi_severity                                                             AS stratum_1,
                cp.drug_a || ' + ' || cp.drug_b                                            AS stratum_2,
                NULL::VARCHAR                                                               AS stratum_3,
                cp.concurrent_patients                                                      AS count_value,
                (SELECT COUNT(DISTINCT person_id) FROM {@cdmSchema}.person)                AS total_value,
                ROUND(
                    CAST(cp.concurrent_patients AS NUMERIC) /
                    NULLIF((SELECT COUNT(DISTINCT person_id) FROM {@cdmSchema}.person), 0),
                    6
                )                                                                           AS ratio_value,
                'Patients with simultaneous active exposure to both drugs'                  AS notes
            FROM concurrent_pairs cp
            WHERE cp.concurrent_patients > 0
            ORDER BY cp.ddi_severity, cp.concurrent_patients DESC
            SQL;
    }
}
