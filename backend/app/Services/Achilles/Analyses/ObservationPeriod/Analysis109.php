<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 109: Duration of observation periods (distribution in days).
 */
class Analysis109 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 109;
    }

    public function analysisName(): string
    {
        return 'Duration of observation periods (days distribution)';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 109;
            INSERT INTO {@resultsSchema}.achilles_results_dist (analysis_id, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT 109 AS analysis_id,
                COUNT(*) AS count_value,
                MIN(duration) AS min_value,
                MAX(duration) AS max_value,
                AVG(duration) AS avg_value,
                STDDEV(duration) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY duration) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY duration) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY duration) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY duration) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY duration) AS p90_value
            FROM (
                SELECT observation_period_end_date - observation_period_start_date AS duration
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
