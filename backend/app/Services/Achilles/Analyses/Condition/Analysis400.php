<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 400: Number of persons with at least one condition occurrence by condition_concept_id.
 */
class Analysis400 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 400;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one condition occurrence by condition_concept_id';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 400;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 400 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.condition_occurrence
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
        return ['condition_occurrence'];
    }
}
