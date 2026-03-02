<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 202: Number of persons by visit occurrence start year-month, by visit_concept_id.
 */
class Analysis202 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 202;
    }

    public function analysisName(): string
    {
        return 'Number of persons with visits by gender';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 202;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 202 AS analysis_id,
                CAST(vo.visit_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT vo.person_id) AS count_value
            FROM {@cdmSchema}.visit_occurrence vo
            JOIN {@cdmSchema}.person p ON vo.person_id = p.person_id
            GROUP BY vo.visit_concept_id, p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['visit_occurrence', 'person'];
    }
}
