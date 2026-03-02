<?php

namespace App\Services\Achilles\Analyses\ConditionEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1002: Distribution of condition era length in days, by condition_concept_id.
 */
class Analysis1002 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1002;
    }

    public function analysisName(): string
    {
        return 'Distribution of condition era length in days by condition concept';
    }

    public function category(): string
    {
        return 'Condition Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 1002;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                1002 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(era_days) AS min_value,
                MAX(era_days) AS max_value,
                ROUND(AVG(CAST(era_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(era_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY era_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY era_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY era_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY era_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY era_days) AS p90_value
            FROM (
                SELECT condition_concept_id,
                    (condition_era_end_date - condition_era_start_date) AS era_days
                FROM {@cdmSchema}.condition_era
                WHERE condition_concept_id != 0
            ) t
            GROUP BY condition_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['condition_era'];
    }
}
