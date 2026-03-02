<?php

namespace App\Services\Analysis\Features;

class DemographicFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'demographics';
    }

    public function label(): string
    {
        return 'Demographics';
    }

    public function buildSql(
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        int $cohortDefinitionId,
        string $dialect,
    ): string {
        // Age distribution by age groups (0-17, 18-34, 35-49, 50-64, 65+)
        $ageSql = "
            SELECT
                'Age Group' AS feature_name,
                CASE
                    WHEN DATEDIFF(c.cohort_start_date, p.birth_datetime) < 0 THEN 'Unknown'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 0 AND 17 THEN '0-17'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 18 AND 34 THEN '18-34'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 35 AND 49 THEN '35-49'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 50 AND 64 THEN '50-64'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) >= 65 THEN '65+'
                    ELSE 'Unknown'
                END AS category,
                COUNT(DISTINCT p.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT p.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.person p
                ON c.subject_id = p.person_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            GROUP BY
                CASE
                    WHEN DATEDIFF(c.cohort_start_date, p.birth_datetime) < 0 THEN 'Unknown'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 0 AND 17 THEN '0-17'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 18 AND 34 THEN '18-34'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 35 AND 49 THEN '35-49'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) BETWEEN 50 AND 64 THEN '50-64'
                    WHEN (EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) >= 65 THEN '65+'
                    ELSE 'Unknown'
                END
        ";

        // Gender distribution
        $genderSql = "
            SELECT
                'Gender' AS feature_name,
                COALESCE(gc.concept_name, 'Unknown') AS category,
                COUNT(DISTINCT p.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT p.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.person p
                ON c.subject_id = p.person_id
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            GROUP BY COALESCE(gc.concept_name, 'Unknown')
        ";

        // Race distribution
        $raceSql = "
            SELECT
                'Race' AS feature_name,
                COALESCE(rc.concept_name, 'Unknown') AS category,
                COUNT(DISTINCT p.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT p.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.person p
                ON c.subject_id = p.person_id
            LEFT JOIN {@vocabSchema}.concept rc
                ON p.race_concept_id = rc.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            GROUP BY COALESCE(rc.concept_name, 'Unknown')
        ";

        return "{$ageSql}\n;\n{$genderSql}\n;\n{$raceSql}";
    }
}
