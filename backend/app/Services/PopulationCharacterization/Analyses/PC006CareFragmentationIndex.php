<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC006 – Care Fragmentation Index
 *
 * Measures the distribution of care fragmentation — how many distinct
 * care sites a person visited per year of observation. High fragmentation
 * (many different facilities) may indicate lack of a primary care home,
 * chronic disease poorly managed, or simply a large integrated network.
 *
 * Two lenses:
 *  1. Overall: distribution of distinct care sites per person-year (all years pooled)
 *  2. Longitudinal: median distinct care sites per person-year, by observation year
 *
 * Uses care_site_id from visit_occurrence (more widely populated than provider_id).
 * Falls back gracefully if care_site_id is NULL everywhere.
 *
 * stratum_1 = fragmentation_bucket ('1' | '2-3' | '4-5' | '6-10' | '11+')
 *             OR year (YYYY) when stratum_2 = 'yearly_median'
 * stratum_2 = 'overall' | 'yearly_median'
 * stratum_3 = ''
 * count_value = person-years in bucket  (overall) | median × 1000 (yearly)
 * total_value = total person-years      (overall) | total persons that year (yearly)
 */
class PC006CareFragmentationIndex implements PopulationCharacterizationInterface
{
    public function analysisId(): string    { return 'PC006'; }
    public function analysisName(): string  { return 'Care Fragmentation Index'; }
    public function category(): string      { return 'Care'; }
    public function requiresOptionalTables(): bool { return true; }

    public function description(): string
    {
        return 'Distribution of distinct care sites visited per person per year. '
            . 'Requires care_site_id to be populated in visit_occurrence. '
            . 'High fragmentation (≥6 sites/year) may indicate lack of primary care '
            . 'continuity or a highly distributed network.';
    }

    public function requiredTables(): array
    {
        return ['person', 'visit_occurrence', 'observation_period'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH person_years AS (
                -- Generate one row per person per observation year
                SELECT p.person_id,
                       gs.yr
                FROM {@cdmSchema}.person p
                JOIN {@cdmSchema}.observation_period op ON op.person_id = p.person_id
                JOIN LATERAL generate_series(
                    EXTRACT(YEAR FROM op.observation_period_start_date)::INT,
                    EXTRACT(YEAR FROM op.observation_period_end_date)::INT
                ) gs(yr) ON TRUE
                WHERE gs.yr BETWEEN 1990 AND EXTRACT(YEAR FROM CURRENT_DATE)::INT
            ),
            sites_per_person_year AS (
                SELECT
                    py.person_id,
                    py.yr,
                    COUNT(DISTINCT vo.care_site_id) AS distinct_sites
                FROM person_years py
                LEFT JOIN {@cdmSchema}.visit_occurrence vo
                    ON vo.person_id = py.person_id
                   AND EXTRACT(YEAR FROM vo.visit_start_date)::INT = py.yr
                   AND vo.care_site_id IS NOT NULL
                GROUP BY py.person_id, py.yr
            ),
            total_py AS (
                SELECT COUNT(*) AS n FROM sites_per_person_year
            ),
            -- 1. Overall distribution
            overall AS (
                SELECT
                    CASE WHEN distinct_sites = 1     THEN '1'
                         WHEN distinct_sites <= 3    THEN '2-3'
                         WHEN distinct_sites <= 5    THEN '4-5'
                         WHEN distinct_sites <= 10   THEN '6-10'
                         ELSE                             '11+'  END  AS stratum_1,
                    'overall'                                          AS stratum_2,
                    ''                                                 AS stratum_3,
                    COUNT(*)                                           AS count_value,
                    (SELECT n FROM total_py)                           AS total_value
                FROM sites_per_person_year
                GROUP BY stratum_1
            ),
            -- 2. Yearly median distinct sites
            yearly AS (
                SELECT
                    yr::TEXT                                           AS stratum_1,
                    'yearly_median'                                    AS stratum_2,
                    ''                                                 AS stratum_3,
                    (PERCENTILE_DISC(0.50) WITHIN GROUP (
                         ORDER BY distinct_sites) * 1000)::BIGINT     AS count_value,
                    COUNT(DISTINCT person_id)                         AS total_value
                FROM sites_per_person_year
                GROUP BY yr
            )
            SELECT * FROM overall
            UNION ALL
            SELECT * FROM yearly
            ORDER BY stratum_2, stratum_1
            SQL;
    }
}
