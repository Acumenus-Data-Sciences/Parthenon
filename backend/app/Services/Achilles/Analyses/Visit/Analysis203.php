<?php

namespace App\Services\Achilles\Analyses\Visit;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 203: Distribution of age at first visit, by gender.
 */
class Analysis203 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 203;
    }

    public function analysisName(): string
    {
        return 'Distribution of age at first visit by gender';
    }

    public function category(): string
    {
        return 'Visit';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 203;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                203 AS analysis_id,
                CAST(p.gender_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value,
                MIN(age_at_visit) AS min_value,
                MAX(age_at_visit) AS max_value,
                ROUND(AVG(CAST(age_at_visit AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(age_at_visit AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY age_at_visit) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY age_at_visit) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY age_at_visit) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY age_at_visit) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY age_at_visit) AS p90_value
            FROM (
                SELECT vo.person_id,
                    FLOOR(EXTRACT(YEAR FROM AGE(vo.visit_start_date,
                        MAKE_DATE(p.year_of_birth, COALESCE(p.month_of_birth, 1), COALESCE(p.day_of_birth, 1))))) AS age_at_visit
                FROM {@cdmSchema}.visit_occurrence vo
                JOIN {@cdmSchema}.person p ON vo.person_id = p.person_id
                WHERE vo.visit_start_date = (
                    SELECT MIN(vo2.visit_start_date)
                    FROM {@cdmSchema}.visit_occurrence vo2
                    WHERE vo2.person_id = vo.person_id
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
        return ['visit_occurrence', 'person'];
    }
}
