<?php

namespace App\Services\Achilles\Analyses\Person;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 10: Number of all persons by year of birth by gender.
 *
 * Used by the demographics endpoint to compute age decile pyramid.
 * stratum_1 = year_of_birth, stratum_2 = gender_concept_id
 */
class Analysis10 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 10;
    }

    public function analysisName(): string
    {
        return 'Number of all persons by year of birth by gender';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 10;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 10 AS analysis_id,
                CAST(year_of_birth AS VARCHAR(255)) AS stratum_1,
                CAST(gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.person
            GROUP BY year_of_birth, gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['person'];
    }
}
