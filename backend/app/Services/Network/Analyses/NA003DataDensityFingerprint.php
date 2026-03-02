<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA003 – Data Density Fingerprint
 *
 * Measures how data-rich each source is: observation period length,
 * visits per person-year, conditions per person, measurements per person,
 * and drug exposures per person. Sparse sources bias risk scores and
 * prevalence estimates downward.
 *
 * stratum_1 = metric name
 * stratum_2 = '' (single aggregate per metric per source)
 * stratum_3 = ''
 * count_value  = metric value × 1000 (integer encoding for storage; divide by 1000 in UI)
 * total_value  = person count used as denominator
 */
class NA003DataDensityFingerprint implements NetworkAnalysisInterface
{
    public function analysisId(): string    { return 'NA003'; }
    public function analysisName(): string  { return 'Data Density Fingerprint'; }
    public function category(): string      { return 'Coverage'; }
    public function minimumSources(): int   { return 1; }

    public function description(): string
    {
        return 'Characterises data richness per source: median observation-period length, '
            . 'visits/person/year, conditions/person, measurements/person, and drug exposures/person. '
            . 'Low-density sources may underestimate condition burden and risk scores.';
    }

    public function requiredTables(): array
    {
        return ['person', 'observation_period', 'visit_occurrence', 'condition_occurrence',
                'measurement', 'drug_exposure'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH person_count AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.person
            ),
            obs_days AS (
                SELECT PERCENTILE_DISC(0.50) WITHIN GROUP (
                    ORDER BY (observation_period_end_date - observation_period_start_date)
                )::NUMERIC AS median_obs_days
                FROM {@cdmSchema}.observation_period
            ),
            visit_rate AS (
                SELECT
                    ROUND(
                        COUNT(*)::NUMERIC
                        / NULLIF((SELECT SUM(observation_period_end_date - observation_period_start_date + 1)
                                  FROM {@cdmSchema}.observation_period), 0)
                        * 365.25, 3)                              AS visits_per_person_year
                FROM {@cdmSchema}.visit_occurrence
            ),
            condition_rate AS (
                SELECT ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT n FROM person_count), 0), 3)
                       AS conditions_per_person
                FROM {@cdmSchema}.condition_occurrence
            ),
            measurement_rate AS (
                SELECT ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT n FROM person_count), 0), 3)
                       AS measurements_per_person
                FROM {@cdmSchema}.measurement
            ),
            drug_rate AS (
                SELECT ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT n FROM person_count), 0), 3)
                       AS drugs_per_person
                FROM {@cdmSchema}.drug_exposure
            )
            SELECT m.stratum_1, '' AS stratum_2, '' AS stratum_3,
                   m.val_x1000 AS count_value, pc.n AS total_value
            FROM (
                SELECT 'median_obs_days'        AS stratum_1, ROUND(median_obs_days * 1000)::BIGINT AS val_x1000 FROM obs_days
                UNION ALL
                SELECT 'visits_per_person_year',  ROUND(COALESCE(visits_per_person_year, 0) * 1000)::BIGINT FROM visit_rate
                UNION ALL
                SELECT 'conditions_per_person',   ROUND(COALESCE(conditions_per_person, 0) * 1000)::BIGINT FROM condition_rate
                UNION ALL
                SELECT 'measurements_per_person', ROUND(COALESCE(measurements_per_person, 0) * 1000)::BIGINT FROM measurement_rate
                UNION ALL
                SELECT 'drugs_per_person',        ROUND(COALESCE(drugs_per_person, 0) * 1000)::BIGINT FROM drug_rate
            ) m
            CROSS JOIN person_count pc
            ORDER BY m.stratum_1
            SQL;
    }
}
