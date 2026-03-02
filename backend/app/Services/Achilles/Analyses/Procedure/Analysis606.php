<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 606: Number of procedure occurrence records by procedure_type_concept_id.
 */
class Analysis606 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 606;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by procedure type concept';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 606;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 606 AS analysis_id,
                CAST(procedure_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence
            GROUP BY procedure_type_concept_id
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
