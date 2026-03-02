<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1801: Number of measurement records by measurement_concept_id.
 */
class Analysis1801 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1801;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by measurement_concept_id';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1801;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1801 AS analysis_id,
                CAST(measurement_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            WHERE measurement_concept_id != 0
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
