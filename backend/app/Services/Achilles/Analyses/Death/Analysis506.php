<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 506: Number of death records by year-month.
 */
class Analysis506 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 506;
    }

    public function analysisName(): string
    {
        return 'Number of death records by year-month';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 506;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 506 AS analysis_id,
                CAST(EXTRACT(YEAR FROM death_date) * 100 + EXTRACT(MONTH FROM death_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.death
            GROUP BY EXTRACT(YEAR FROM death_date) * 100 + EXTRACT(MONTH FROM death_date)
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
