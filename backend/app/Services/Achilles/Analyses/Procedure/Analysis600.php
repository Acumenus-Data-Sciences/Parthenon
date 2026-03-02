<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 600: Number of persons with at least one procedure occurrence by procedure_concept_id.
 */
class Analysis600 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 600;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one procedure occurrence by procedure_concept_id';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 600;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 600 AS analysis_id,
                CAST(procedure_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
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
