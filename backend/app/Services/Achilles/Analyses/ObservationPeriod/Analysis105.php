<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 105: Duration of observation periods (length of observation in months).
 */
class Analysis105 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 105;
    }

    public function analysisName(): string
    {
        return 'Length of observation (months) by gender';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 105;
            INSERT INTO {@resultsSchema}.achilles_results_dist (analysis_id, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT 105 AS analysis_id,
                COUNT(*) AS count_value,
                MIN(months) AS min_value,
                MAX(months) AS max_value,
                AVG(months) AS avg_value,
                STDDEV(months) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY months) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY months) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY months) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY months) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY months) AS p90_value
            FROM (
                SELECT EXTRACT(YEAR FROM AGE(observation_period_end_date, observation_period_start_date)) * 12
                    + EXTRACT(MONTH FROM AGE(observation_period_end_date, observation_period_start_date)) AS months
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
