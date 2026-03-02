<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 101: Number of observation periods.
 */
class Analysis101 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 101;
    }

    public function analysisName(): string
    {
        return 'Number of observation periods';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 101;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, count_value)
            SELECT 101 AS analysis_id,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.observation_period
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['observation_period'];
    }
}
