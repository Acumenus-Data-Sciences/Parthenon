<?php

namespace App\Services\Achilles\Analyses\Person;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 3: Number of persons by year of birth.
 */
class Analysis3 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 3;
    }

    public function analysisName(): string
    {
        return 'Number of persons by year of birth';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 3;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 3 AS analysis_id,
                CAST(year_of_birth AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.person
            GROUP BY year_of_birth
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
