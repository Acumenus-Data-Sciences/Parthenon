<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 207: Number of visit records by visit_end_date year.
 */
class Analysis207 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 207;
    }

    public function analysisName(): string
    {
        return 'Number of visit records by visit end date year';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 207;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 207 AS analysis_id,
                CAST(EXTRACT(YEAR FROM visit_end_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence
            WHERE visit_end_date IS NOT NULL
            GROUP BY EXTRACT(YEAR FROM visit_end_date)
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
