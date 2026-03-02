<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 716: Distribution of days_supply for drug exposures, by drug_concept_id.
 */
class Analysis716 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 716;
    }

    public function analysisName(): string
    {
        return 'Distribution of days supply by drug concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 716;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                716 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(days_supply) AS min_value,
                MAX(days_supply) AS max_value,
                ROUND(AVG(CAST(days_supply AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(days_supply AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY days_supply) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY days_supply) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY days_supply) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY days_supply) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY days_supply) AS p90_value
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND days_supply IS NOT NULL
              AND days_supply > 0
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
