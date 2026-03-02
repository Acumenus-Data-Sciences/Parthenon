<?php

namespace App\Services\Achilles\Analyses\DrugEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 902: Distribution of drug era length in days, by drug_concept_id.
 */
class Analysis902 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 902;
    }

    public function analysisName(): string
    {
        return 'Distribution of drug era length in days by drug concept';
    }

    public function category(): string
    {
        return 'Drug Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 902;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                902 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
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
                SELECT drug_concept_id,
                    (drug_era_end_date - drug_era_start_date) AS era_days
                FROM {@cdmSchema}.drug_era
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
        return ['drug_era'];
    }
}
