<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 810: Number of observation records by value_as_concept_id.
 */
class Analysis810 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 810;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by value as concept';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 810;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 810 AS analysis_id,
                CAST(COALESCE(value_as_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation
            GROUP BY value_as_concept_id
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
