<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 500: Number of persons with a death record.
 */
class Analysis500 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 500;
    }

    public function analysisName(): string
    {
        return 'Number of persons with a death record';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 500;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 500 AS analysis_id,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.death
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['death'];
    }
}
