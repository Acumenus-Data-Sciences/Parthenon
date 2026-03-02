<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 804: Number of observation records by observation_concept_id × unit_concept_id.
 */
class Analysis804 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 804;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by observation concept and unit concept';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 804;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 804 AS analysis_id,
                CAST(observation_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(COALESCE(unit_concept_id, 0) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation
            WHERE observation_concept_id != 0
            GROUP BY observation_concept_id, unit_concept_id
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
