<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 102: Number of persons by observation period start month.
 */
class Analysis102 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 102;
    }

    public function analysisName(): string
    {
        return 'Number of persons by observation period start month';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 102;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 102 AS analysis_id,
                CAST(EXTRACT(YEAR FROM observation_period_start_date) * 100 + EXTRACT(MONTH FROM observation_period_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.observation_period
            GROUP BY EXTRACT(YEAR FROM observation_period_start_date), EXTRACT(MONTH FROM observation_period_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['observation_period'];
    }
}
