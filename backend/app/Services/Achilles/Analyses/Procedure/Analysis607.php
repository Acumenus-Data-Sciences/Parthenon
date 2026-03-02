<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 607: Number of procedure occurrence records by visit_concept_id (care setting).
 */
class Analysis607 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 607;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records by visit concept (care setting)';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 607;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 607 AS analysis_id,
                CAST(COALESCE(vo.visit_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence po
            LEFT JOIN {@cdmSchema}.visit_occurrence vo
                ON po.visit_occurrence_id = vo.visit_occurrence_id
            GROUP BY vo.visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['procedure_occurrence', 'visit_occurrence'];
    }
}
