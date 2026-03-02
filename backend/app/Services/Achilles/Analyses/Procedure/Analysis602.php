<?php

namespace App\Services\Achilles\Analyses\Procedure;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 602: Number of persons with procedure by procedure_concept_id by gender.
 */
class Analysis602 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 602;
    }

    public function analysisName(): string
    {
        return 'Number of persons with procedure by procedure_concept_id by gender';
    }

    public function category(): string
    {
        return 'Procedure';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 602;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 602 AS analysis_id,
                CAST(po.procedure_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT po.person_id) AS count_value
            FROM {@cdmSchema}.procedure_occurrence po
            JOIN {@cdmSchema}.person p ON po.person_id = p.person_id
            WHERE po.procedure_concept_id != 0
            GROUP BY po.procedure_concept_id, p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['procedure_occurrence', 'person'];
    }
}
