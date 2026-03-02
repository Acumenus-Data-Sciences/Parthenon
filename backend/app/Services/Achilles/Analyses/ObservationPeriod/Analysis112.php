<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 112: Number of persons by observation period end year.
 */
class Analysis112 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 112;
    }

    public function analysisName(): string
    {
        return 'Number of persons by observation period end year';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 112;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 112 AS analysis_id,
                CAST(EXTRACT(YEAR FROM observation_period_end_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.observation_period
            GROUP BY EXTRACT(YEAR FROM observation_period_end_date)
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
