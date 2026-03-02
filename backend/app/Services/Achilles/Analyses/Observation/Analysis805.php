<?php

namespace App\Services\Achilles\Analyses\Observation;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 805: Distribution of age at first observation, by gender.
 */
class Analysis805 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 805;
    }

    public function analysisName(): string
    {
        return 'Distribution of age at first observation by gender';
    }

    public function category(): string
    {
        return 'Observation';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 805;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                805 AS analysis_id,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(age_at_first) AS min_value,
                MAX(age_at_first) AS max_value,
                ROUND(AVG(CAST(age_at_first AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(age_at_first AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY age_at_first) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY age_at_first) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY age_at_first) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY age_at_first) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY age_at_first) AS p90_value
            FROM (
                SELECT o.person_id,
                    FLOOR(EXTRACT(YEAR FROM AGE(MIN(o.observation_date),
                        MAKE_DATE(p.year_of_birth, COALESCE(p.month_of_birth, 1), COALESCE(p.day_of_birth, 1))))) AS age_at_first
                FROM {@cdmSchema}.observation o
                JOIN {@cdmSchema}.person p ON o.person_id = p.person_id
                GROUP BY o.person_id, p.year_of_birth, p.month_of_birth, p.day_of_birth
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
        return ['observation', 'person'];
    }
}
