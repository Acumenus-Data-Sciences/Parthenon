<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 507: Number of death records by cause_concept_id.
 */
class Analysis507 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 507;
    }

    public function analysisName(): string
    {
        return 'Number of death records by cause concept';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 507;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 507 AS analysis_id,
                CAST(cause_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.death
            WHERE cause_concept_id IS NOT NULL
            GROUP BY cause_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['death'];
    }
}
