<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 503: Number of death records by death_date year.
 */
class Analysis503 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 503;
    }

    public function analysisName(): string
    {
        return 'Number of death records by death date year';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 503;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 503 AS analysis_id,
                CAST(EXTRACT(YEAR FROM death_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.death
            GROUP BY EXTRACT(YEAR FROM death_date)
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
