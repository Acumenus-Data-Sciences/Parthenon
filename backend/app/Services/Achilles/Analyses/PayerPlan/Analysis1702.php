<?php

namespace App\Services\Achilles\Analyses\PayerPlan;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1702: Number of persons by payer plan period start year.
 */
class Analysis1702 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1702;
    }

    public function analysisName(): string
    {
        return 'Number of persons by payer plan period start year';
    }

    public function category(): string
    {
        return 'Payer Plan';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1702;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1702 AS analysis_id,
                CAST(EXTRACT(YEAR FROM payer_plan_period_start_date) AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.payer_plan_period
            GROUP BY EXTRACT(YEAR FROM payer_plan_period_start_date)
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['payer_plan_period'];
    }
}
