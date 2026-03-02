<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 715: Number of drug exposure records with invalid drug_type_concept_id.
 */
class Analysis715 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 715;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records with invalid drug type concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 715;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 715 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure de
            LEFT JOIN {@cdmSchema}.concept c ON de.drug_type_concept_id = c.concept_id
                AND c.domain_id = 'Type Concept'
            WHERE de.drug_type_concept_id = 0
               OR c.concept_id IS NULL
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_exposure', 'concept'];
    }
}
