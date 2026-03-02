<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 405: Number of condition occurrence records by condition_concept_id and stop_reason.
 */
class Analysis405 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 405;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records by condition concept and stop reason';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 405;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 405 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COALESCE(stop_reason, 'NULL') AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence
            WHERE condition_concept_id != 0
            GROUP BY condition_concept_id, stop_reason
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
