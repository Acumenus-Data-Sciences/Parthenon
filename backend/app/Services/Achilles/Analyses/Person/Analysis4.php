<?php

namespace App\Services\Achilles\Analyses\Person;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 4: Number of persons by race.
 */
class Analysis4 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 4;
    }

    public function analysisName(): string
    {
        return 'Number of persons by race';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 4;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 4 AS analysis_id,
                CAST(race_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.person
            GROUP BY race_concept_id
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
