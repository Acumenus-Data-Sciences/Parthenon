<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 411: Number of condition occurrence records by condition_concept_id by year-month.
 */
class Analysis411 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 411;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records by condition_concept_id by year-month';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 411;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 411 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(EXTRACT(YEAR FROM condition_start_date) * 100 + EXTRACT(MONTH FROM condition_start_date) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence
            WHERE condition_concept_id != 0
            GROUP BY condition_concept_id,
                EXTRACT(YEAR FROM condition_start_date) * 100 + EXTRACT(MONTH FROM condition_start_date)
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
