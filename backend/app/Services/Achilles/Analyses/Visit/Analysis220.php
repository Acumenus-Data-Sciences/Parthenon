<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 220: Number of visit records by provider_id (de-identified as presence/absence).
 *
 * stratum_1: 1 = provider recorded, 0 = no provider.
 */
class Analysis220 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 220;
    }

    public function analysisName(): string
    {
        return 'Number of visit records by provider recorded indicator';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 220;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 220 AS analysis_id,
                CAST(CASE WHEN provider_id IS NOT NULL THEN 1 ELSE 0 END AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence
            GROUP BY CASE WHEN provider_id IS NOT NULL THEN 1 ELSE 0 END
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence'];
    }
}
