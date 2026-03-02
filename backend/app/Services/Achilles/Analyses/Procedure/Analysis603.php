<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 603: Number of procedure occurrence records by procedure_date month (YYYYMM).
 */
class Analysis603 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 603;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by procedure date month';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 603;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 603 AS analysis_id,
                CAST(EXTRACT(YEAR FROM procedure_date) * 100 + EXTRACT(MONTH FROM procedure_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence
            GROUP BY EXTRACT(YEAR FROM procedure_date), EXTRACT(MONTH FROM procedure_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['procedure_occurrence'];
    }
}
