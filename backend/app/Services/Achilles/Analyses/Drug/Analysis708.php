<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 708: Number of drug exposure records with invalid drug_concept_id
 * (concept_id = 0 or concept not found as a standard Drug concept in vocabulary).
 */
class Analysis708 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 708;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records with invalid drug concept';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 708;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 708 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure de
            LEFT JOIN {@cdmSchema}.concept c ON de.drug_concept_id = c.concept_id
                AND c.domain_id = 'Drug'
                AND c.standard_concept = 'S'
            WHERE de.drug_concept_id = 0
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
