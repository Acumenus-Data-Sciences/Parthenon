<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 700: Number of persons with at least one drug exposure by drug_concept_id.
 */
class Analysis700 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 700;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one drug exposure by drug_concept_id';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 700;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 700 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
            GROUP BY drug_concept_id
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
