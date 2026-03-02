<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 410: Number of condition occurrence records by condition_type_concept_id.
 */
class Analysis410 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 410;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records by condition type concept';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 410;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 410 AS analysis_id,
                CAST(condition_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence
            GROUP BY condition_type_concept_id
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
