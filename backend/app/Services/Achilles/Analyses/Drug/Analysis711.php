<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 711: Number of drug exposure records by drug_concept_id by year-month.
 */
class Analysis711 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 711;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records by drug_concept_id by year-month';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 711;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 711 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(EXTRACT(YEAR FROM drug_exposure_start_date) * 100 + EXTRACT(MONTH FROM drug_exposure_start_date) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
            GROUP BY drug_concept_id,
                EXTRACT(YEAR FROM drug_exposure_start_date) * 100 + EXTRACT(MONTH FROM drug_exposure_start_date)
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
