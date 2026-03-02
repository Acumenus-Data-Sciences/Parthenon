<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 703: Distribution of drug exposure duration in days, by drug_concept_id.
 */
class Analysis703 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 703;
    }

    public function analysisName(): string
    {
        return 'Distribution of drug exposure duration in days by drug concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 703;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                703 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(duration_days) AS min_value,
                MAX(duration_days) AS max_value,
                ROUND(AVG(CAST(duration_days AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(duration_days AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY duration_days) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY duration_days) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY duration_days) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY duration_days) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY duration_days) AS p90_value
            FROM (
                SELECT drug_concept_id,
                    GREATEST(COALESCE(days_supply, (drug_exposure_end_date - drug_exposure_start_date)), 0) AS duration_days
                FROM {@cdmSchema}.drug_exposure
                WHERE drug_concept_id != 0
            ) t
            GROUP BY drug_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['drug_exposure'];
    }
}
