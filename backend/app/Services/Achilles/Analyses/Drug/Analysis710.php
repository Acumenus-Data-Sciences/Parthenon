<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 710: Number of drug exposure records by route_concept_id.
 */
class Analysis710 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 710;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records by route concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 710;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 710 AS analysis_id,
                CAST(COALESCE(route_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure
            GROUP BY route_concept_id
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
