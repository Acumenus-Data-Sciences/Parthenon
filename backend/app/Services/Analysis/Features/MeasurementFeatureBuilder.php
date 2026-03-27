<?php

namespace App\Services\Analysis\Features;

class MeasurementFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'measurements';
    }

    public function label(): string
    {
        return 'Measurements';
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
                m.measurement_concept_id AS concept_id,
                COALESCE(c2.concept_name, 'Unknown') AS concept_name,
                COUNT(DISTINCT m.person_id) AS person_count,
                ROUND(
                    (100.0 * COUNT(DISTINCT m.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0))::numeric,
                    2
                ) AS percent_value,
                ROUND(AVG(CASE WHEN m.value_as_number IS NOT NULL THEN m.value_as_number END)::numeric, 4) AS mean_value,
                ROUND(STDDEV(CASE WHEN m.value_as_number IS NOT NULL THEN m.value_as_number END)::numeric, 4) AS stddev_value,
                MIN(CASE WHEN m.value_as_number IS NOT NULL THEN m.value_as_number END) AS min_value,
                MAX(CASE WHEN m.value_as_number IS NOT NULL THEN m.value_as_number END) AS max_value,
                ROUND(
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN m.value_as_number IS NOT NULL THEN m.value_as_number END)::numeric,
                    4
                ) AS median_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.measurement m
                ON c.subject_id = m.person_id
                AND m.measurement_date >= c.cohort_start_date
                AND m.measurement_date <= c.cohort_end_date
            LEFT JOIN {@vocabSchema}.concept c2
                ON m.measurement_concept_id = c2.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
                AND m.measurement_concept_id != 0
            GROUP BY m.measurement_concept_id, c2.concept_name
            ORDER BY person_count DESC
            LIMIT 50
        ";
    }
}
