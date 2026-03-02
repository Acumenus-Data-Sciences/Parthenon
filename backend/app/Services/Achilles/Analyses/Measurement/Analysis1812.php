<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1812: Number of measurement records with no numeric value
 * (value_as_number IS NULL and value_as_concept_id = 0 or NULL).
 */
class Analysis1812 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1812;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records with no numeric or concept value';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1812;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1812 AS analysis_id,
                CAST(measurement_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            WHERE measurement_concept_id != 0
              AND value_as_number IS NULL
              AND (value_as_concept_id IS NULL OR value_as_concept_id = 0)
            GROUP BY measurement_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['measurement'];
    }
}
