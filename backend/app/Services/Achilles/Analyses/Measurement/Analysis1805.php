<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1805: Number of measurement records by measurement_date month (YYYYMM).
 */
class Analysis1805 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1805;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by measurement date month';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1805;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1805 AS analysis_id,
                CAST(EXTRACT(YEAR FROM measurement_date) * 100 + EXTRACT(MONTH FROM measurement_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            GROUP BY EXTRACT(YEAR FROM measurement_date), EXTRACT(MONTH FROM measurement_date)
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
