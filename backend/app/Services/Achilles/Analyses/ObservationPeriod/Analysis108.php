<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 108: Number of persons by number of observation periods.
 */
class Analysis108 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 108;
    }

    public function analysisName(): string
    {
        return 'Number of persons by number of observation periods';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 108;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 108 AS analysis_id,
                CAST(num_periods AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM (
                SELECT person_id,
                    COUNT(*) AS num_periods
                FROM {@cdmSchema}.observation_period
                GROUP BY person_id
            ) t
            GROUP BY num_periods
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
