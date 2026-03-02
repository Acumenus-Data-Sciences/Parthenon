<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 502: Number of death records by death_date month (YYYYMM).
 */
class Analysis502 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 502;
    }

    public function analysisName(): string
    {
        return 'Number of death records by death date month';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 502;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 502 AS analysis_id,
                CAST(EXTRACT(YEAR FROM death_date) * 100 + EXTRACT(MONTH FROM death_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.death
            GROUP BY EXTRACT(YEAR FROM death_date), EXTRACT(MONTH FROM death_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['death'];
    }
}
