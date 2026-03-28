<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1817: Number of measurement records with invalid unit_concept_id
 * (unit_concept_id = 0 or not in vocabulary as a Unit concept).
 */
class Analysis1817 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1817;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records with invalid unit concept';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1817;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 1817 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement m
            LEFT JOIN {@vocabSchema}.concept c ON m.unit_concept_id = c.concept_id
                AND c.domain_id = 'Unit'
                AND c.standard_concept = 'S'
            WHERE m.unit_concept_id IS NOT NULL
              AND m.unit_concept_id != 0
              AND c.concept_id IS NULL
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
