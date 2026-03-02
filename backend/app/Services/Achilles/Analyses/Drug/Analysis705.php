<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 705: Number of drug exposure records by drug_exposure_start_date year.
 */
class Analysis705 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 705;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records by drug exposure start year';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 705;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 705 AS analysis_id,
                CAST(EXTRACT(YEAR FROM drug_exposure_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure
            GROUP BY EXTRACT(YEAR FROM drug_exposure_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_exposure'];
    }
}
