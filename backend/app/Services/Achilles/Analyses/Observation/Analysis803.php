<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 803: Number of observation records by observation_date year.
 */
class Analysis803 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 803;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by observation date year';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 803;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 803 AS analysis_id,
                CAST(EXTRACT(YEAR FROM observation_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation
            GROUP BY EXTRACT(YEAR FROM observation_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['observation'];
    }
}
