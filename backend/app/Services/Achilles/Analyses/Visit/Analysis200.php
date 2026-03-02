<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 200: Number of persons with at least one visit occurrence by visit_concept_id.
 */
class Analysis200 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 200;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one visit occurrence by visit_concept_id';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 200;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 200 AS analysis_id,
                CAST(visit_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.visit_occurrence
            GROUP BY visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence'];
    }
}
