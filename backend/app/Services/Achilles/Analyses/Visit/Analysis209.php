<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 209: Number of visit records by visit_start_date month (YYYYMM).
 */
class Analysis209 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 209;
    }

    public function analysisName(): string
    {
        return 'Number of visit records by visit start month';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 209;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 209 AS analysis_id,
                CAST(EXTRACT(YEAR FROM visit_start_date) * 100 + EXTRACT(MONTH FROM visit_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence
            GROUP BY EXTRACT(YEAR FROM visit_start_date), EXTRACT(MONTH FROM visit_start_date)
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
