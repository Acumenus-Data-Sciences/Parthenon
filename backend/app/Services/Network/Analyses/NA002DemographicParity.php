<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA002 – Cross-Site Demographic Distribution Parity
 *
 * Returns age-decile, sex, and race distributions per source.
 * Network aggregate detects population-mix differences that explain
 * prevalence heterogeneity found in NA001.
 *
 * stratum_1 = dimension ('age_decile' | 'sex' | 'race')
 * stratum_2 = category label ('30-39' | 'Male' | 'White' | …)
 * stratum_3 = concept_id of the category (for linking)
 * count_value = persons in category
 * total_value = total persons in CDM
 */
class NA002DemographicParity implements NetworkAnalysisInterface
{
    public function analysisId(): string
    {
        return 'NA002';
    }

    public function analysisName(): string
    {
        return 'Demographic Distribution Parity';
    }

    public function category(): string
    {
        return 'Demographics';
    }

    public function minimumSources(): int
    {
        return 2;
    }

    public function description(): string
    {
        return 'Compares age-decile, sex, and race distributions across CDM sources. '
            .'Sources with divergent demographics require case-mix adjustment before '
            .'interpreting prevalence or risk score differences.';
    }

    public function requiredTables(): array
    {
        return ['person', 'concept'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH total AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.person
            ),
            age_deciles AS (
                SELECT
                    'age_decile'                                AS stratum_1,
                    CASE
                        WHEN age < 10  THEN '0-9'
                        WHEN age < 20  THEN '10-19'
                        WHEN age < 30  THEN '20-29'
                        WHEN age < 40  THEN '30-39'
                        WHEN age < 50  THEN '40-49'
                        WHEN age < 60  THEN '50-59'
                        WHEN age < 70  THEN '60-69'
                        WHEN age < 80  THEN '70-79'
                        WHEN age < 90  THEN '80-89'
                        ELSE                '90+'
                    END                                        AS stratum_2,
                    ''                                         AS stratum_3,
                    COUNT(*)                                   AS count_value
                FROM (
                    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                               MAKE_DATE(year_of_birth,
                                         COALESCE(month_of_birth, 7),
                                         COALESCE(day_of_birth, 1))))::INT AS age
                    FROM {@cdmSchema}.person
                ) ages
                GROUP BY stratum_2
            ),
            sex_dist AS (
                SELECT
                    'sex'                                                  AS stratum_1,
                    COALESCE(c.concept_name, 'Unknown')                   AS stratum_2,
                    p.gender_concept_id::TEXT                              AS stratum_3,
                    COUNT(*)                                               AS count_value
                FROM {@cdmSchema}.person p
                LEFT JOIN {@cdmSchema}.concept c ON c.concept_id = p.gender_concept_id
                GROUP BY p.gender_concept_id, c.concept_name
            ),
            race_dist AS (
                SELECT
                    'race'                                                 AS stratum_1,
                    COALESCE(c.concept_name, 'Unknown')                   AS stratum_2,
                    p.race_concept_id::TEXT                                AS stratum_3,
                    COUNT(*)                                               AS count_value
                FROM {@cdmSchema}.person p
                LEFT JOIN {@cdmSchema}.concept c ON c.concept_id = p.race_concept_id
                GROUP BY p.race_concept_id, c.concept_name
            )
            SELECT a.stratum_1, a.stratum_2, a.stratum_3, a.count_value, t.n AS total_value
            FROM (
                SELECT * FROM age_deciles
                UNION ALL SELECT * FROM sex_dist
                UNION ALL SELECT * FROM race_dist
            ) a
            CROSS JOIN total t
            ORDER BY stratum_1, count_value DESC
            SQL;
    }
}
