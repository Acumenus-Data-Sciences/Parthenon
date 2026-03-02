<?php

namespace App\Services\Achilles\Analyses\ConditionEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1003: Distribution of days since last condition era (gap between consecutive condition eras)
 * by condition_concept_id.
 */
class Analysis1003 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1003;
    }

    public function analysisName(): string
    {
        return 'Distribution of gap between condition eras by condition concept';
    }

    public function category(): string
    {
        return 'Condition Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 1003;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                1003 AS analysis_id,
                CAST(condition_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(gap_days) AS min_value,
                MAX(gap_days) AS max_value,
                ROUND(AVG(CAST(gap_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(gap_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY gap_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY gap_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY gap_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY gap_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY gap_days) AS p90_value
            FROM (
                SELECT curr.condition_concept_id,
                    (curr.condition_era_start_date - prev.condition_era_end_date) AS gap_days
                FROM {@cdmSchema}.condition_era curr
                JOIN {@cdmSchema}.condition_era prev
                    ON curr.person_id = prev.person_id
                    AND curr.condition_concept_id = prev.condition_concept_id
                    AND curr.condition_era_start_date > prev.condition_era_end_date
                WHERE curr.condition_concept_id != 0
                  AND NOT EXISTS (
                      SELECT 1 FROM {@cdmSchema}.condition_era mid
                      WHERE mid.person_id = curr.person_id
                        AND mid.condition_concept_id = curr.condition_concept_id
                        AND mid.condition_era_start_date > prev.condition_era_end_date
                        AND mid.condition_era_start_date < curr.condition_era_start_date
                  )
            ) t
            WHERE gap_days > 0
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
