<?php

namespace App\Services\Analysis\Features;

class VisitFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'visits';
    }

    public function label(): string
    {
        return 'Visits';
    }

    public function buildSql(
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        int $cohortDefinitionId,
        string $dialect,
    ): string {
        // Visit type distribution with count per type and average visits per person
        return "
            SELECT
                vo.visit_concept_id AS concept_id,
                COALESCE(c2.concept_name, 'Unknown') AS concept_name,
                COUNT(DISTINCT vo.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT vo.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value,
                COUNT(vo.visit_occurrence_id) AS total_visits,
                ROUND(
                    1.0 * COUNT(vo.visit_occurrence_id) /
                    NULLIF(COUNT(DISTINCT vo.person_id), 0),
                    2
                ) AS avg_visits_per_person
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.visit_occurrence vo
                ON c.subject_id = vo.person_id
                AND vo.visit_start_date >= c.cohort_start_date
                AND vo.visit_start_date <= c.cohort_end_date
            LEFT JOIN {@vocabSchema}.concept c2
                ON vo.visit_concept_id = c2.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            GROUP BY vo.visit_concept_id, c2.concept_name
            ORDER BY person_count DESC
        ";
    }
}
