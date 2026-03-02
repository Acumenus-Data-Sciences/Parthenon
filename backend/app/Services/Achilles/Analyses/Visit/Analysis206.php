<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 206: Distribution of visit length in days, stratified by visit_concept_id.
 */
class Analysis206 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 206;
    }

    public function analysisName(): string
    {
        return 'Distribution of visit length in days by visit concept';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 206;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                206 AS analysis_id,
                CAST(visit_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(visit_days) AS min_value,
                MAX(visit_days) AS max_value,
                ROUND(AVG(CAST(visit_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(visit_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY visit_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY visit_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY visit_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY visit_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY visit_days) AS p90_value
            FROM (
                SELECT visit_concept_id,
                    GREATEST((visit_end_date - visit_start_date), 0) AS visit_days
                FROM {@cdmSchema}.visit_occurrence
                WHERE visit_end_date IS NOT NULL
            ) t
            GROUP BY visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence'];
    }
}
