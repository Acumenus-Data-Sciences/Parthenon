<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ001 – Observation Period Integrity
 *
 * Four structural checks on the observation_period table:
 *  1. Overlapping periods for the same person (OMOP requires non-overlapping)
 *  2. Zero-length periods (start = end)
 *  3. Implausibly long periods (> 40 years)
 *  4. Periods where start_date > end_date (impossible)
 */
class TQ001ObservationPeriodIntegrity implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'TQ001';
    }

    public function analysisName(): string
    {
        return 'Observation Period Integrity';
    }

    public function category(): string
    {
        return 'Temporal Quality';
    }

    public function description(): string
    {
        return 'Checks for structural violations in the observation_period table: overlapping periods per person, zero-length periods, impossible start > end, and implausibly long periods (> 40 years).';
    }

    public function severity(): string
    {
        return 'critical';
    }

    public function flagThreshold(): ?float
    {
        return null;
    } // flag any occurrence

    public function requiredTables(): array
    {
        return ['observation_period'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            -- 1. Overlapping observation periods (same person)
            SELECT
                'overlapping_periods'                                                   AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(DISTINCT op1.person_id)                                           AS count_value,
                (SELECT COUNT(DISTINCT person_id)
                    FROM {@cdmSchema}.observation_period)                               AS total_value,
                ROUND(
                    CAST(COUNT(DISTINCT op1.person_id) AS NUMERIC) /
                    NULLIF((SELECT COUNT(DISTINCT person_id)
                            FROM {@cdmSchema}.observation_period), 0),
                    6
                )                                                                       AS ratio_value,
                'Persons with two or more observation periods that overlap in date range' AS notes
            FROM {@cdmSchema}.observation_period op1
            JOIN {@cdmSchema}.observation_period op2
                ON  op1.person_id = op2.person_id
                AND op1.observation_period_id < op2.observation_period_id
                AND op1.observation_period_start_date <= op2.observation_period_end_date
                AND op1.observation_period_end_date   >= op2.observation_period_start_date
            HAVING COUNT(DISTINCT op1.person_id) > 0

            UNION ALL

            -- 2. Zero-length observation periods (start_date = end_date)
            SELECT
                'zero_length_period'                                                    AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.observation_period)                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.observation_period), 0),
                    6
                )                                                                       AS ratio_value,
                'Observation periods with start_date = end_date (zero duration)'       AS notes
            FROM {@cdmSchema}.observation_period
            WHERE observation_period_start_date = observation_period_end_date
            HAVING COUNT(*) > 0

            UNION ALL

            -- 3. Implausibly long periods (> 40 years = 14610 days)
            SELECT
                'implausibly_long_period'                                               AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.observation_period)                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.observation_period), 0),
                    6
                )                                                                       AS ratio_value,
                'Observation periods spanning more than 40 years'                      AS notes
            FROM {@cdmSchema}.observation_period
            WHERE observation_period_end_date - observation_period_start_date > 14610
            HAVING COUNT(*) > 0

            UNION ALL

            -- 4. Impossible periods (start_date > end_date)
            SELECT
                'start_after_end'                                                       AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.observation_period)                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.observation_period), 0),
                    6
                )                                                                       AS ratio_value,
                'Observation periods where start_date is strictly after end_date'      AS notes
            FROM {@cdmSchema}.observation_period
            WHERE observation_period_start_date > observation_period_end_date
            HAVING COUNT(*) > 0
            SQL;
    }
}
