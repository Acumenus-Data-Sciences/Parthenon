<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 106: Distribution of observation period length in days (overall).
 */
class Analysis106 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 106;
    }

    public function analysisName(): string
    {
        return 'Distribution of observation period length in days';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 106;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                106 AS analysis_id,
                COUNT(*) AS count_value,
                MIN(obs_days) AS min_value,
                MAX(obs_days) AS max_value,
                ROUND(AVG(CAST(obs_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(obs_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY obs_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY obs_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY obs_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY obs_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY obs_days) AS p90_value
            FROM (
                SELECT (observation_period_end_date - observation_period_start_date) AS obs_days
                FROM {@cdmSchema}.observation_period
            ) t
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['observation_period'];
    }
}
