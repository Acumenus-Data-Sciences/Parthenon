<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC004 – Drug-Indication Concordance
 *
 * For the top 20 most prescribed drug ingredients, computes the fraction of
 * patients who have NO condition occurrence recorded within a ±90/+30 day
 * window around drug exposure start. A high "no-clinical-context" rate may
 * indicate missing diagnosis documentation rather than true absence of
 * indication.
 *
 * Uses concept_ancestor to roll up drug concepts to ingredient level.
 */
class CC003DrugIndicationConcordance implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'CC003';
    }

    public function analysisName(): string
    {
        return 'Drug-Indication Concordance';
    }

    public function category(): string
    {
        return 'Drug Coherence';
    }

    public function description(): string
    {
        return 'For the top 20 prescribed drug ingredients, measures the fraction of patients with no condition recorded in a ±90/+30 day window around drug start (undocumented clinical context rate).';
    }

    public function severity(): string
    {
        return 'major';
    }

    public function flagThreshold(): ?float
    {
        return 0.30;
    } // flag if >30% of patients lack context

    public function requiredTables(): array
    {
        return ['drug_exposure', 'condition_occurrence', 'concept', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH top_ingredients AS (
                SELECT ca.ancestor_concept_id AS ingredient_id,
                       COUNT(*)               AS rx_count
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                    ON de.drug_concept_id = ca.descendant_concept_id
                JOIN {@cdmSchema}.concept ic
                    ON ca.ancestor_concept_id = ic.concept_id
                    AND ic.concept_class_id = 'Ingredient'
                    AND ic.standard_concept = 'S'
                WHERE de.drug_concept_id != 0
                GROUP BY ca.ancestor_concept_id
                ORDER BY rx_count DESC
                LIMIT 20
            ),
            drug_patients AS (
                SELECT DISTINCT ti.ingredient_id, de.person_id
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                    ON de.drug_concept_id = ca.descendant_concept_id
                JOIN top_ingredients ti ON ca.ancestor_concept_id = ti.ingredient_id
            ),
            patients_with_context AS (
                SELECT DISTINCT ti.ingredient_id, de.person_id
                FROM {@cdmSchema}.drug_exposure de
                JOIN {@cdmSchema}.concept_ancestor ca
                    ON de.drug_concept_id = ca.descendant_concept_id
                JOIN top_ingredients ti ON ca.ancestor_concept_id = ti.ingredient_id
                JOIN {@cdmSchema}.condition_occurrence co
                    ON de.person_id = co.person_id
                    AND co.condition_concept_id != 0
                    AND co.condition_start_date BETWEEN
                        de.drug_exposure_start_date - INTERVAL '90 days'
                        AND de.drug_exposure_start_date + INTERVAL '30 days'
            ),
            summary AS (
                SELECT
                    dp.ingredient_id,
                    COUNT(DISTINCT dp.person_id)                                AS total_patients,
                    COUNT(DISTINCT pwc.person_id)                               AS patients_with_context,
                    COUNT(DISTINCT dp.person_id) - COUNT(DISTINCT pwc.person_id) AS patients_without_context
                FROM drug_patients dp
                LEFT JOIN patients_with_context pwc
                    ON dp.ingredient_id = pwc.ingredient_id
                    AND dp.person_id    = pwc.person_id
                GROUP BY dp.ingredient_id
            )
            SELECT
                'no_clinical_context'                                           AS stratum_1,
                CAST(s.ingredient_id AS VARCHAR(255))                           AS stratum_2,
                c.concept_name                                                  AS stratum_3,
                s.patients_without_context                                      AS count_value,
                s.total_patients                                                AS total_value,
                ROUND(
                    CAST(s.patients_without_context AS NUMERIC) /
                    NULLIF(s.total_patients, 0),
                    6
                )                                                               AS ratio_value,
                'Fraction of drug users with no condition in ±90/+30 day window' AS notes
            FROM summary s
            JOIN {@cdmSchema}.concept c ON s.ingredient_id = c.concept_id
            WHERE s.total_patients > 0
            ORDER BY ratio_value DESC
            SQL;
    }
}
