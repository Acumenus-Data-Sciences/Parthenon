<?php

namespace App\Services\Achilles\Analyses\Person;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 0: Number of persons.
 */
class Analysis0 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 0;
    }

    public function analysisName(): string
    {
        return 'Number of persons';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 0;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 0 AS analysis_id,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.person
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
