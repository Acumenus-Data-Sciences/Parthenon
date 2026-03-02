<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 208: Number of visit records by visit_start_date year.
 */
class Analysis208 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 208;
    }

    public function analysisName(): string
    {
        return 'Number of visit records by visit start date year';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 208;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 208 AS analysis_id,
                CAST(EXTRACT(YEAR FROM visit_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence
            GROUP BY EXTRACT(YEAR FROM visit_start_date)
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
