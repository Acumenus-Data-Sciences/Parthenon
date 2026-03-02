<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 420: Number of condition occurrence records by condition_start_date year.
 */
class Analysis420 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 420;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records by condition start year';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 420;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 420 AS analysis_id,
                CAST(EXTRACT(YEAR FROM condition_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence
            GROUP BY EXTRACT(YEAR FROM condition_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence'];
    }
}
