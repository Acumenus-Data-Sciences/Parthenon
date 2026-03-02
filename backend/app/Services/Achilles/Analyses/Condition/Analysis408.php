<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 408: Number of condition occurrence records by visit_concept_id (care setting).
 */
class Analysis408 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 408;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records by visit concept (care setting)';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 408;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 408 AS analysis_id,
                CAST(COALESCE(vo.visit_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence co
            LEFT JOIN {@cdmSchema}.visit_occurrence vo
                ON co.visit_occurrence_id = vo.visit_occurrence_id
            GROUP BY vo.visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'visit_occurrence'];
    }
}
