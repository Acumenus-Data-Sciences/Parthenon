<?php

namespace App\Services\Achilles\Analyses\Condition;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 402: Number of persons with condition by gender.
 */
class Analysis402 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 402;
    }

    public function analysisName(): string
    {
        return 'Number of persons with condition by condition_concept_id by gender';
    }

    public function category(): string
    {
        return 'Condition';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 402;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 402 AS analysis_id,
                CAST(co.condition_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT co.person_id) AS count_value
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.person p ON co.person_id = p.person_id
            WHERE co.condition_concept_id != 0
            GROUP BY co.condition_concept_id, p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'person'];
    }
}
