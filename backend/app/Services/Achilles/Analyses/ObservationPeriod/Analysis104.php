<?php

namespace App\Services\Achilles\Analyses\ObservationPeriod;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 104: Distribution of age at first observation period (in years).
 */
class Analysis104 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 104;
    }

    public function analysisName(): string
    {
        return 'Distribution of age at first observation period';
    }

    public function category(): string
    {
        return 'Observation Period';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 104;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                104 AS analysis_id,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(age_at_start) AS min_value,
                MAX(age_at_start) AS max_value,
                ROUND(AVG(CAST(age_at_start AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(age_at_start AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY age_at_start) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY age_at_start) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY age_at_start) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY age_at_start) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY age_at_start) AS p90_value
            FROM (
                SELECT op.person_id,
                    FLOOR(EXTRACT(YEAR FROM AGE(op.observation_period_start_date,
                        MAKE_DATE(p.year_of_birth, COALESCE(p.month_of_birth, 1), COALESCE(p.day_of_birth, 1))))) AS age_at_start
                FROM {@cdmSchema}.observation_period op
                JOIN {@cdmSchema}.person p ON op.person_id = p.person_id
                WHERE op.observation_period_start_date = (
                    SELECT MIN(op2.observation_period_start_date)
                    FROM {@cdmSchema}.observation_period op2
                    WHERE op2.person_id = op.person_id
                )
            ) t
            JOIN {@cdmSchema}.person p ON t.person_id = p.person_id
            GROUP BY p.gender_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['observation_period', 'person'];
    }
}
