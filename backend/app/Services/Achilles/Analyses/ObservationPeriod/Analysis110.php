<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 110: Number of persons by number of observation periods.
 */
class Analysis110 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 110;
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
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 110;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 110 AS analysis_id,
                CAST(op_count AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM (
                SELECT person_id, COUNT(*) AS op_count
                FROM {@cdmSchema}.observation_period
                GROUP BY person_id
            ) t
            GROUP BY op_count
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
