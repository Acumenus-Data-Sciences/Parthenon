<?php

namespace App\Services\Analysis\Features;

class ConditionFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'conditions';
    }

    public function label(): string
    {
        return 'Conditions';
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
                co.condition_concept_id AS concept_id,
                COALESCE(c2.concept_name, 'Unknown') AS concept_name,
                COUNT(DISTINCT co.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT co.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.condition_occurrence co
                ON c.subject_id = co.person_id
                AND co.condition_start_date >= c.cohort_start_date
                AND co.condition_start_date <= c.cohort_end_date
            LEFT JOIN {@vocabSchema}.concept c2
                ON co.condition_concept_id = c2.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
                AND co.condition_concept_id != 0
            GROUP BY co.condition_concept_id, c2.concept_name
            ORDER BY person_count DESC
            LIMIT 100
        ";
    }
}
