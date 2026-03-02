<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1802: Number of persons with measurement by measurement_concept_id by gender.
 */
class Analysis1802 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1802;
    }

    public function analysisName(): string
    {
        return 'Number of persons with measurement by measurement_concept_id by gender';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1802;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 1802 AS analysis_id,
                CAST(m.measurement_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_2,
                COUNT(DISTINCT m.person_id) AS count_value
            FROM {@cdmSchema}.measurement m
            JOIN {@cdmSchema}.person p ON m.person_id = p.person_id
            WHERE m.measurement_concept_id != 0
            GROUP BY m.measurement_concept_id, p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['measurement', 'person'];
    }
}
