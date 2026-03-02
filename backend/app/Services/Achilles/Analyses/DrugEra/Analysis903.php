<?php

namespace App\Services\Achilles\Analyses\DrugEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 903: Distribution of gap in days between drug eras, by drug_concept_id.
 */
class Analysis903 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 903;
    }

    public function analysisName(): string
    {
        return 'Distribution of gap between drug eras by drug concept';
    }

    public function category(): string
    {
        return 'Drug Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 903;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                903 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
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
                SELECT curr.drug_concept_id,
                    (curr.drug_era_start_date - prev.drug_era_end_date) AS gap_days
                FROM {@cdmSchema}.drug_era curr
                JOIN {@cdmSchema}.drug_era prev
                    ON curr.person_id = prev.person_id
                    AND curr.drug_concept_id = prev.drug_concept_id
                    AND curr.drug_era_start_date > prev.drug_era_end_date
                WHERE curr.drug_concept_id != 0
                  AND NOT EXISTS (
                      SELECT 1 FROM {@cdmSchema}.drug_era mid
                      WHERE mid.person_id = curr.person_id
                        AND mid.drug_concept_id = curr.drug_concept_id
                        AND mid.drug_era_start_date > prev.drug_era_end_date
                        AND mid.drug_era_start_date < curr.drug_era_start_date
                  )
            ) t
            WHERE gap_days > 0
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
