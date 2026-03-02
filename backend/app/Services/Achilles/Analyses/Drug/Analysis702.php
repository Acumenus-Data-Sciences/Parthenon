<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 702: Number of persons with drug by drug_concept_id by gender.
 */
class Analysis702 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 702;
    }

    public function analysisName(): string
    {
        return 'Number of persons with drug by drug_concept_id by gender';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 702;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 702 AS analysis_id,
                CAST(de.drug_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT de.person_id) AS count_value
            FROM {@cdmSchema}.drug_exposure de
            JOIN {@cdmSchema}.person p ON de.person_id = p.person_id
            WHERE de.drug_concept_id != 0
            GROUP BY de.drug_concept_id, p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_exposure', 'person'];
    }
}
