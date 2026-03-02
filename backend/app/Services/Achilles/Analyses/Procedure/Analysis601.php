<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 601: Number of procedure occurrence records by procedure_concept_id.
 */
class Analysis601 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 601;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by procedure_concept_id';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 601;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 601 AS analysis_id,
                CAST(procedure_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence
            WHERE procedure_concept_id != 0
            GROUP BY procedure_concept_id
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
