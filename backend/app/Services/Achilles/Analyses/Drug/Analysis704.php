<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 704: Distribution of drug exposure quantity, by drug_concept_id.
 */
class Analysis704 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 704;
    }

    public function analysisName(): string
    {
        return 'Distribution of drug exposure quantity by drug concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 704;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                704 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(quantity) AS min_value,
                MAX(quantity) AS max_value,
                ROUND(AVG(CAST(quantity AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(quantity AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY quantity) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY quantity) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY quantity) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY quantity) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY quantity) AS p90_value
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND quantity IS NOT NULL
              AND quantity > 0
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
