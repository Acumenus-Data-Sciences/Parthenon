<?php

namespace App\Services\Achilles\Analyses\ConditionEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1001: Number of condition era records by condition_concept_id.
 */
class Analysis1001 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1001;
    }

    public function analysisName(): string
    {
        return 'Number of condition era records by condition_concept_id';
    }

    public function category(): string
    {
        return 'Condition Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1001;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1001 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_era
            WHERE condition_concept_id != 0
            GROUP BY condition_concept_id
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
