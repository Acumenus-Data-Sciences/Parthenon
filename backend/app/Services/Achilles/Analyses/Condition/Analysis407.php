<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 407: Number of condition occurrence records with invalid condition_concept_id
 * (concept_id = 0 or concept not found in vocabulary).
 */
class Analysis407 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 407;
    }

    public function analysisName(): string
    {
        return 'Number of condition occurrence records with invalid condition concept';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 407;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 407 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence co
            LEFT JOIN {@cdmSchema}.concept c ON co.condition_concept_id = c.concept_id
                AND c.domain_id = 'Condition'
                AND c.standard_concept = 'S'
            WHERE co.condition_concept_id = 0
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
