<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1803: Distribution of numeric measurement value, by measurement_concept_id.
 */
class Analysis1803 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1803;
    }

    public function analysisName(): string
    {
        return 'Distribution of numeric measurement value by measurement concept';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 1803;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                1803 AS analysis_id,
                CAST(measurement_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(value_as_number) AS min_value,
                MAX(value_as_number) AS max_value,
                ROUND(AVG(CAST(value_as_number AS NUMERIC)), 4) AS avg_value,
                ROUND(CAST(STDDEV(CAST(value_as_number AS NUMERIC)) AS NUMERIC), 4) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY value_as_number) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY value_as_number) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY value_as_number) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY value_as_number) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY value_as_number) AS p90_value
            FROM {@cdmSchema}.measurement
            WHERE measurement_concept_id != 0
              AND value_as_number IS NOT NULL
            GROUP BY measurement_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['measurement'];
    }
}
