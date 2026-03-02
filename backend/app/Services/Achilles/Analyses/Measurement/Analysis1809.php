<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1809: Number of measurement records with invalid measurement_type_concept_id.
 */
class Analysis1809 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1809;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records with invalid measurement type concept';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1809;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 1809 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement m
            LEFT JOIN {@cdmSchema}.concept c ON m.measurement_type_concept_id = c.concept_id
                AND c.domain_id = 'Type Concept'
            WHERE m.measurement_type_concept_id = 0
               OR c.concept_id IS NULL
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['measurement', 'concept'];
    }
}
