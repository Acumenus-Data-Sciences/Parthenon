<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 609: Number of procedure occurrence records with invalid procedure_type_concept_id.
 */
class Analysis609 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 609;
    }

    public function analysisName(): string
    {
        return 'Number of procedure occurrence records with invalid procedure type concept';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 609;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 609 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence po
            LEFT JOIN {@cdmSchema}.concept c ON po.procedure_type_concept_id = c.concept_id
                AND c.domain_id = 'Type Concept'
            WHERE po.procedure_type_concept_id = 0
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
