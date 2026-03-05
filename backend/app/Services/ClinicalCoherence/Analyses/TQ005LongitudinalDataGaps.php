<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ005 – Longitudinal Data Gaps
 *
 * For persons with at least 2 full years of observation, identifies calendar
 * years that fall entirely within the observation period yet contain zero
 * clinical events of any type (condition, drug, procedure, or measurement).
 *
 * "Silent years" inside a continuous observation window are a strong signal of:
 *  - EHR system transitions (old system discontinued, new system not yet live)
 *  - Partial data extracts (certain date ranges excluded from source pull)
 *  - Observation period spanning non-enrolled gaps
 *
 * Uses generate_series() — PostgreSQL-only, consistent with our PostgreSQL-only stance.
 * First and last years of each observation period are excluded (commonly partial years).
 */
class TQ005LongitudinalDataGaps implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'TQ005';
    }

    public function analysisName(): string
    {
        return 'Longitudinal Data Gaps (Silent Years)';
    }

    public function category(): string
    {
        return 'Temporal Quality';
    }

    public function description(): string
    {
        return 'For persons with ≥2 full years of observation, detects calendar years within the observation window that have zero clinical events. Silent years suggest EHR system transitions or extract boundary errors.';
    }

    public function severity(): string
    {
        return 'major';
    }

    public function flagThreshold(): ?float
    {
        return 0.05;
    } // flag years where >5% of long-term patients are silent

    public function requiredTables(): array
    {
        return [
            'observation_period',
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
        ];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH long_obs_persons AS (
                -- Persons with at least one observation period spanning ≥ 2 full years
                SELECT DISTINCT person_id
                FROM {@cdmSchema}.observation_period
                WHERE observation_period_end_date - observation_period_start_date > 730
            ),
            person_obs_years AS (
                -- All interior calendar years for each long-term observation period
                -- (exclude first and last year as they may be partial)
                SELECT op.person_id, gs.obs_year
                FROM {@cdmSchema}.observation_period op
                JOIN long_obs_persons lp ON op.person_id = lp.person_id
                CROSS JOIN LATERAL generate_series(
                    EXTRACT(YEAR FROM op.observation_period_start_date)::INT + 1,
                    EXTRACT(YEAR FROM op.observation_period_end_date)::INT   - 1
                ) AS gs(obs_year)
                WHERE EXTRACT(YEAR FROM op.observation_period_end_date)::INT
                    - EXTRACT(YEAR FROM op.observation_period_start_date)::INT >= 2
            ),
            event_years AS (
                -- All calendar years in which a person has any clinical event
                SELECT person_id, EXTRACT(YEAR FROM condition_start_date)::INT AS event_year
                FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id != 0
                UNION
                SELECT person_id, EXTRACT(YEAR FROM drug_exposure_start_date)::INT
                FROM {@cdmSchema}.drug_exposure
                WHERE drug_concept_id != 0
                UNION
                SELECT person_id, EXTRACT(YEAR FROM procedure_date)::INT
                FROM {@cdmSchema}.procedure_occurrence
                WHERE procedure_concept_id != 0
                UNION
                SELECT person_id, EXTRACT(YEAR FROM measurement_date)::INT
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id != 0
            ),
            silent_person_years AS (
                -- Interior observation years with no events of any type
                SELECT poy.person_id, poy.obs_year
                FROM person_obs_years poy
                LEFT JOIN event_years ey
                    ON poy.person_id = ey.person_id
                    AND poy.obs_year  = ey.event_year
                WHERE ey.event_year IS NULL
            )
            SELECT
                'silent_year_within_observation'                                        AS stratum_1,
                CAST(sy.obs_year AS VARCHAR(255))                                       AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(DISTINCT sy.person_id)                                            AS count_value,
                (SELECT COUNT(DISTINCT person_id) FROM long_obs_persons)               AS total_value,
                ROUND(
                    CAST(COUNT(DISTINCT sy.person_id) AS NUMERIC) /
                    NULLIF((SELECT COUNT(DISTINCT person_id) FROM long_obs_persons), 0),
                    6
                )                                                                       AS ratio_value,
                'Persons in long-term observation with zero clinical events in this calendar year' AS notes
            FROM silent_person_years sy
            GROUP BY sy.obs_year
            HAVING COUNT(DISTINCT sy.person_id) > 0
            ORDER BY sy.obs_year
            SQL;
    }
}
