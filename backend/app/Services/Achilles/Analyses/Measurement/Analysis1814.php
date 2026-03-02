<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1814: Distribution of age at first measurement, by gender.
 */
class Analysis1814 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1814;
    }

    public function analysisName(): string
    {
        return 'Distribution of age at first measurement by gender';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 1814;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                1814 AS analysis_id,
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
                SELECT m.person_id,
                    FLOOR(EXTRACT(YEAR FROM AGE(MIN(m.measurement_date),
                        MAKE_DATE(p.year_of_birth, COALESCE(p.month_of_birth, 1), COALESCE(p.day_of_birth, 1))))) AS age_at_first
                FROM {@cdmSchema}.measurement m
                JOIN {@cdmSchema}.person p ON m.person_id = p.person_id
                GROUP BY m.person_id, p.year_of_birth, p.month_of_birth, p.day_of_birth
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
        return ['measurement', 'person'];
    }
}
