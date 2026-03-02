<?php

namespace App\Services\Achilles\Analyses\DrugEra;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 900: Number of persons with at least one drug era by drug_concept_id.
 */
class Analysis900 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 900;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one drug era by drug_concept_id';
    }

    public function category(): string
    {
        return 'Drug Era';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 900;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 900 AS analysis_id,
                CAST(drug_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.drug_era
            WHERE drug_concept_id != 0
            GROUP BY drug_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_era'];
    }
}
