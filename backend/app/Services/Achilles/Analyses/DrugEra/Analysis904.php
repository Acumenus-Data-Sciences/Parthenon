<?php

namespace App\Services\Achilles\Analyses\DrugEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 904: Number of drug era records by drug_era_start_date year.
 */
class Analysis904 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 904;
    }

    public function analysisName(): string
    {
        return 'Number of drug era records by drug era start year';
    }

    public function category(): string
    {
        return 'Drug Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 904;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 904 AS analysis_id,
                CAST(EXTRACT(YEAR FROM drug_era_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_era
            GROUP BY EXTRACT(YEAR FROM drug_era_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_era'];
    }
}
