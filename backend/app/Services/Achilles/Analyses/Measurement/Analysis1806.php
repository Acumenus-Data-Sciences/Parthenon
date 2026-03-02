<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1806: Number of measurement records by measurement_type_concept_id.
 */
class Analysis1806 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1806;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by measurement type concept';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1806;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1806 AS analysis_id,
                CAST(measurement_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            GROUP BY measurement_type_concept_id
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
