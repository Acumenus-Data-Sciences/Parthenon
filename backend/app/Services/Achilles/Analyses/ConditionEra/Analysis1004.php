<?php

namespace App\Services\Achilles\Analyses\ConditionEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1004: Number of condition era records by condition_era_start_date year.
 */
class Analysis1004 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1004;
    }

    public function analysisName(): string
    {
        return 'Number of condition era records by condition era start year';
    }

    public function category(): string
    {
        return 'Condition Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1004;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1004 AS analysis_id,
                CAST(EXTRACT(YEAR FROM condition_era_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_era
            GROUP BY EXTRACT(YEAR FROM condition_era_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_era'];
    }
}
