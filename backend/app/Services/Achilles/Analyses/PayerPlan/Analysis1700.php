<?php

namespace App\Services\Achilles\Analyses\PayerPlan;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1700: Number of persons with at least one payer plan period record.
 */
class Analysis1700 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1700;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one payer plan period';
    }

    public function category(): string
    {
        return 'Payer Plan';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1700;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 1700 AS analysis_id,
                COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.payer_plan_period
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
