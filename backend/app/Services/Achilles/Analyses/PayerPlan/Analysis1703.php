<?php

namespace App\Services\Achilles\Analyses\PayerPlan;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1703: Distribution of payer plan period length in days.
 */
class Analysis1703 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1703;
    }

    public function analysisName(): string
    {
        return 'Distribution of payer plan period length in days';
    }

    public function category(): string
    {
        return 'Payer Plan';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 1703;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                1703 AS analysis_id,
                COUNT(*) AS count_value,
                MIN(plan_days) AS min_value,
                MAX(plan_days) AS max_value,
                ROUND(AVG(CAST(plan_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(plan_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY plan_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY plan_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY plan_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY plan_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY plan_days) AS p90_value
            FROM (
                SELECT (payer_plan_period_end_date - payer_plan_period_start_date) AS plan_days
                FROM {@cdmSchema}.payer_plan_period
                WHERE payer_plan_period_end_date IS NOT NULL
            ) t
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['payer_plan_period'];
    }
}
