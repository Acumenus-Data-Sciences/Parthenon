<?php

namespace App\Services\Analysis\Features;

class ProcedureFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'procedures';
    }

    public function label(): string
    {
        return 'Procedures';
    }

    public function buildSql(
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        int $cohortDefinitionId,
        string $dialect,
    ): string {
        return "
            SELECT
                po.procedure_concept_id AS concept_id,
                COALESCE(c2.concept_name, 'Unknown') AS concept_name,
                COUNT(DISTINCT po.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT po.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.procedure_occurrence po
                ON c.subject_id = po.person_id
                AND po.procedure_date >= c.cohort_start_date
                AND po.procedure_date <= c.cohort_end_date
            LEFT JOIN {@vocabSchema}.concept c2
                ON po.procedure_concept_id = c2.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
                AND po.procedure_concept_id != 0
            GROUP BY po.procedure_concept_id, c2.concept_name
            ORDER BY person_count DESC
            LIMIT 100
        ";
    }
}
