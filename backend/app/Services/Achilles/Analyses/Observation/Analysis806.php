<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 806: Number of observation records by observation_type_concept_id.
 */
class Analysis806 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 806;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by observation type concept';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 806;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 806 AS analysis_id,
                CAST(observation_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation
            GROUP BY observation_type_concept_id
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
