<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 811: Number of observation records by observation_concept_id by year-month.
 */
class Analysis811 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 811;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by observation_concept_id by year-month';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 811;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 811 AS analysis_id,
                CAST(observation_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(EXTRACT(YEAR FROM observation_date) * 100 + EXTRACT(MONTH FROM observation_date) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation
            WHERE observation_concept_id != 0
            GROUP BY observation_concept_id,
                EXTRACT(YEAR FROM observation_date) * 100 + EXTRACT(MONTH FROM observation_date)
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
