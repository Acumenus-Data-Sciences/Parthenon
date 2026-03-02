<?php

namespace App\Services\Achilles\Analyses\Person;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 5: Number of persons by ethnicity.
 */
class Analysis5 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 5;
    }

    public function analysisName(): string
    {
        return 'Number of persons by ethnicity';
    }

    public function category(): string
    {
        return 'Person';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 5;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 5 AS analysis_id,
                CAST(ethnicity_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.person
            GROUP BY ethnicity_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['person'];
    }
}
