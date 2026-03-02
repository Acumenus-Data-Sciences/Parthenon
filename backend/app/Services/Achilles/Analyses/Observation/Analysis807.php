<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 807: Number of observation records by visit_concept_id (care setting).
 */
class Analysis807 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 807;
    }

    public function analysisName(): string
    {
        return 'Number of observation records by visit concept (care setting)';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 807;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 807 AS analysis_id,
                CAST(COALESCE(vo.visit_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation o
            LEFT JOIN {@cdmSchema}.visit_occurrence vo
                ON o.visit_occurrence_id = vo.visit_occurrence_id
            GROUP BY vo.visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['observation', 'visit_occurrence'];
    }
}
