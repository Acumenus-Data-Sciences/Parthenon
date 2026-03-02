<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1811: Number of measurement records by measurement_concept_id by year-month.
 */
class Analysis1811 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1811;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by measurement_concept_id by year-month';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1811;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 1811 AS analysis_id,
                CAST(measurement_concept_id AS VARCHAR(255)) AS stratum_1,
                CAST(EXTRACT(YEAR FROM measurement_date) * 100 + EXTRACT(MONTH FROM measurement_date) AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            WHERE measurement_concept_id != 0
            GROUP BY measurement_concept_id,
                EXTRACT(YEAR FROM measurement_date) * 100 + EXTRACT(MONTH FROM measurement_date)
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
