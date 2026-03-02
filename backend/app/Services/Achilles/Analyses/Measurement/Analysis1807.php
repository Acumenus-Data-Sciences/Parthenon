<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1807: Number of measurement records by visit_concept_id (care setting).
 */
class Analysis1807 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1807;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by visit concept (care setting)';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1807;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1807 AS analysis_id,
                CAST(COALESCE(vo.visit_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement m
            LEFT JOIN {@cdmSchema}.visit_occurrence vo
                ON m.visit_occurrence_id = vo.visit_occurrence_id
            GROUP BY vo.visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['measurement', 'visit_occurrence'];
    }
}
