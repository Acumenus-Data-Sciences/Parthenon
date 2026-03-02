<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 608: Number of procedure occurrence records with invalid procedure_concept_id
 * (concept_id = 0 or concept not found as a standard Procedure concept in vocabulary).
 */
class Analysis608 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 608;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records with invalid procedure concept';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 608;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 608 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence po
            LEFT JOIN {@cdmSchema}.concept c ON po.procedure_concept_id = c.concept_id
                AND c.domain_id = 'Procedure'
                AND c.standard_concept = 'S'
            WHERE po.procedure_concept_id = 0
               OR c.concept_id IS NULL
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['procedure_occurrence', 'concept'];
    }
}
