<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 409: Number of condition occurrence records with invalid condition_type_concept_id
 * (concept_id = 0 or not in the concept table as a valid type concept).
 */
class Analysis409 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 409;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records with invalid condition type concept';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 409;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 409 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence co
            LEFT JOIN {@cdmSchema}.concept c ON co.condition_type_concept_id = c.concept_id
                AND c.domain_id = 'Type Concept'
            WHERE co.condition_type_concept_id = 0
               OR c.concept_id IS NULL
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'concept'];
    }
}
