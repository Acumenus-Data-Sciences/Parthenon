<?php

namespace App\Services\Achilles\Analyses\ConditionEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1000: Number of persons with at least one condition era by condition_concept_id.
 */
class Analysis1000 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1000;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one condition era by condition_concept_id';
    }

    public function category(): string
    {
        return 'Condition Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1000;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1000 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
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
