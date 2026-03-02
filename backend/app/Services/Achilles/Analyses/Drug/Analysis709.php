<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 709: Number of drug exposure records by drug_type_concept_id.
 */
class Analysis709 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 709;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records by drug type concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 709;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 709 AS analysis_id,
                CAST(drug_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure
            GROUP BY drug_type_concept_id
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
