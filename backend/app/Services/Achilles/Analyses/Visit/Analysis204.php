<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 204: Number of persons with at least one visit, by visit_concept_id.
 */
class Analysis204 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 204;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one visit by visit concept';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 204;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 204 AS analysis_id,
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
