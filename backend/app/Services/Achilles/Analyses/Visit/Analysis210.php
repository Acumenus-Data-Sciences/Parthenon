<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 210: Number of visit records with no linked condition, drug, or procedure.
 *
 * stratum_1: 0 = has linked records, 1 = no linked records.
 */
class Analysis210 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 210;
    }

    public function analysisName(): string
    {
        return 'Number of visit records with no associated condition, drug, or procedure';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 210;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 210 AS analysis_id,
                CAST(CASE WHEN linked.visit_occurrence_id IS NULL THEN 1 ELSE 0 END AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence vo
            LEFT JOIN (
                SELECT DISTINCT visit_occurrence_id FROM {@cdmSchema}.condition_occurrence WHERE visit_occurrence_id IS NOT NULL
                UNION
                SELECT DISTINCT visit_occurrence_id FROM {@cdmSchema}.drug_exposure WHERE visit_occurrence_id IS NOT NULL
                UNION
                SELECT DISTINCT visit_occurrence_id FROM {@cdmSchema}.procedure_occurrence WHERE visit_occurrence_id IS NOT NULL
            ) linked ON vo.visit_occurrence_id = linked.visit_occurrence_id
            GROUP BY CASE WHEN linked.visit_occurrence_id IS NULL THEN 1 ELSE 0 END
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence', 'condition_occurrence', 'drug_exposure', 'procedure_occurrence'];
    }
}
