<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 809: Number of observation records with invalid observation_type_concept_id.
 */
class Analysis809 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 809;
    }

    public function analysisName(): string
    {
        return 'Number of observation records with invalid observation type concept';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 809;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 809 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation o
            LEFT JOIN {@vocabSchema}.concept c ON o.observation_type_concept_id = c.concept_id
                AND c.domain_id = 'Type Concept'
            WHERE o.observation_type_concept_id = 0
               OR c.concept_id IS NULL
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['observation', 'concept'];
    }
}
