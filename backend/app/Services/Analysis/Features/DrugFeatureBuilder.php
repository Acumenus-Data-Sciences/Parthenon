<?php

namespace App\Services\Analysis\Features;

class DrugFeatureBuilder implements FeatureBuilderInterface
{
    public function key(): string
    {
        return 'drugs';
    }

    public function label(): string
    {
        return 'Drug Exposures';
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
                de.drug_concept_id AS concept_id,
                COALESCE(c2.concept_name, 'Unknown') AS concept_name,
                COUNT(DISTINCT de.person_id) AS person_count,
                ROUND(
                    100.0 * COUNT(DISTINCT de.person_id) /
                    NULLIF((SELECT COUNT(DISTINCT subject_id) FROM {@cohortTable} WHERE cohort_definition_id = {$cohortDefinitionId}), 0),
                    2
                ) AS percent_value
            FROM {@cohortTable} c
            JOIN {@cdmSchema}.drug_exposure de
                ON c.subject_id = de.person_id
                AND de.drug_exposure_start_date >= c.cohort_start_date
                AND de.drug_exposure_start_date <= c.cohort_end_date
            LEFT JOIN {@vocabSchema}.concept c2
                ON de.drug_concept_id = c2.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
                AND de.drug_concept_id != 0
            GROUP BY de.drug_concept_id, c2.concept_name
            ORDER BY person_count DESC
            LIMIT 100
        ";
    }
}
