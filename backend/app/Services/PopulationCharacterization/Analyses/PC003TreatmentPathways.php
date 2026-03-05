<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC003 – Treatment Pathway Analysis
 *
 * For the top-10 most prevalent conditions, computes:
 *   - Step 1: Which drug ingredient was started first within 90 days of diagnosis
 *   - Step 2: Which drug ingredient was started 91–365 days after diagnosis
 *             (indicative of first-line switch / add-on therapy)
 *
 * This is a simplified pathway analysis. Full Sankey-diagram pathways
 * (OHDSI PathwayAnalysis) are available in the Pathways analysis module.
 * This analysis provides a quick per-condition first/second-line summary.
 *
 * stratum_1 = condition_concept_id
 * stratum_2 = pathway_step ('1_first_line' | '2_second_line')
 * stratum_3 = drug_ingredient_concept_id (top drugs at each step)
 * count_value = persons with this drug at this step
 * total_value = total persons diagnosed with this condition
 */
class PC003TreatmentPathways implements PopulationCharacterizationInterface
{
    public function analysisId(): string
    {
        return 'PC003';
    }

    public function analysisName(): string
    {
        return 'Treatment Pathway Analysis';
    }

    public function category(): string
    {
        return 'Treatment';
    }

    public function requiresOptionalTables(): bool
    {
        return false;
    }

    public function description(): string
    {
        return 'First-line and second-line drug therapy distributions for the top-10 most '
            .'prevalent conditions. First-line = drug started within 90 days of condition '
            .'index date; second-line = drug started 91–365 days after index date.';
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_era', 'concept_ancestor', 'concept'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH top_conditions AS (
                SELECT condition_concept_id,
                       COUNT(DISTINCT person_id) AS condition_persons
                FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id != 0
                GROUP BY condition_concept_id
                ORDER BY condition_persons DESC
                LIMIT 10
            ),
            -- Index date per person per condition = earliest condition start
            condition_index AS (
                SELECT co.person_id,
                       co.condition_concept_id,
                       MIN(co.condition_start_date) AS index_date,
                       tc.condition_persons         AS total_with_condition
                FROM {@cdmSchema}.condition_occurrence co
                JOIN top_conditions tc
                    ON tc.condition_concept_id = co.condition_concept_id
                GROUP BY co.person_id, co.condition_concept_id, tc.condition_persons
            ),
            -- First-line: drug era starting within 90 days of index
            first_line AS (
                SELECT ci.condition_concept_id,
                       '1_first_line'                  AS pathway_step,
                       de.drug_concept_id,
                       ci.total_with_condition,
                       COUNT(DISTINCT ci.person_id)    AS person_count
                FROM condition_index ci
                JOIN {@cdmSchema}.drug_era de
                    ON de.person_id = ci.person_id
                   AND de.drug_era_start_date BETWEEN ci.index_date
                                                  AND ci.index_date + 90
                WHERE de.drug_concept_id != 0
                GROUP BY ci.condition_concept_id, de.drug_concept_id, ci.total_with_condition
            ),
            -- Second-line: drug era starting 91–365 days after index
            second_line AS (
                SELECT ci.condition_concept_id,
                       '2_second_line'                 AS pathway_step,
                       de.drug_concept_id,
                       ci.total_with_condition,
                       COUNT(DISTINCT ci.person_id)    AS person_count
                FROM condition_index ci
                JOIN {@cdmSchema}.drug_era de
                    ON de.person_id = ci.person_id
                   AND de.drug_era_start_date BETWEEN ci.index_date + 91
                                                  AND ci.index_date + 365
                WHERE de.drug_concept_id != 0
                GROUP BY ci.condition_concept_id, de.drug_concept_id, ci.total_with_condition
            ),
            -- Top-5 drugs per condition per step
            ranked AS (
                SELECT condition_concept_id, pathway_step, drug_concept_id,
                       total_with_condition, person_count,
                       ROW_NUMBER() OVER (
                           PARTITION BY condition_concept_id, pathway_step
                           ORDER BY person_count DESC
                       ) AS rn
                FROM (
                    SELECT * FROM first_line
                    UNION ALL
                    SELECT * FROM second_line
                ) all_steps
            )
            SELECT
                r.condition_concept_id::TEXT   AS stratum_1,
                r.pathway_step                 AS stratum_2,
                r.drug_concept_id::TEXT        AS stratum_3,
                r.person_count                 AS count_value,
                r.total_with_condition         AS total_value
            FROM ranked r
            WHERE r.rn <= 5
            ORDER BY r.condition_concept_id, r.pathway_step, r.person_count DESC
            SQL;
    }
}
