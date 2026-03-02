<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 610: Number of procedure occurrence records by modifier_concept_id.
 */
class Analysis610 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 610;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by modifier concept';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 610;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 610 AS analysis_id,
                CAST(COALESCE(modifier_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence
            GROUP BY modifier_concept_id
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
