<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 611: Number of procedure occurrence records by procedure_concept_id by year-month.
 */
class Analysis611 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 611;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by procedure_concept_id by year-month';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 611;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 611 AS analysis_id,
                CAST(procedure_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(EXTRACT(YEAR FROM procedure_date) * 100 + EXTRACT(MONTH FROM procedure_date) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence
            WHERE procedure_concept_id != 0
            GROUP BY procedure_concept_id,
                EXTRACT(YEAR FROM procedure_date) * 100 + EXTRACT(MONTH FROM procedure_date)
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
