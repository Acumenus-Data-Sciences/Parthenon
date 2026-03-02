<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 113: Number of persons by observation period overlap indicator.
 *
 * stratum_1: 1 = has overlapping observation periods, 0 = no overlap.
 */
class Analysis113 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 113;
    }

    public function analysisName(): string
    {
        return 'Number of persons with overlapping observation periods';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 113;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 113 AS analysis_id,
                CAST(has_overlap AS VARCHAR(255)) AS stratum_1,
                COUNT(DISTINCT person_id) AS count_value
            FROM (
                SELECT DISTINCT a.person_id,
                    CASE WHEN EXISTS (
                        SELECT 1
                        FROM {@cdmSchema}.observation_period b
                        WHERE a.person_id = b.person_id
                          AND a.observation_period_id <> b.observation_period_id
                          AND a.observation_period_start_date <= b.observation_period_end_date
                          AND a.observation_period_end_date >= b.observation_period_start_date
                    ) THEN 1 ELSE 0 END AS has_overlap
                FROM {@cdmSchema}.observation_period a
            ) t
            GROUP BY has_overlap
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
