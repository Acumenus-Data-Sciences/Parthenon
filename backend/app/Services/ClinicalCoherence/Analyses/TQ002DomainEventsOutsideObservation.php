<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ002 – Domain Events Outside Observation Windows
 *
 * For each of five clinical domains, counts the number of records whose
 * primary event date falls outside every observation period for that person.
 * A record is "inside" if event_date BETWEEN obs_start AND obs_end for ANY
 * observation period belonging to that person.
 *
 * High rates indicate systematic mapping errors (e.g. date fields swapped),
 * missing observation periods, or EHR extract boundary issues.
 *
 * Domains checked: condition_occurrence, drug_exposure, procedure_occurrence,
 *                  measurement, observation
 */
class TQ002DomainEventsOutsideObservation implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'TQ002';
    }

    public function analysisName(): string
    {
        return 'Domain Events Outside Observation Windows';
    }

    public function category(): string
    {
        return 'Temporal Quality';
    }

    public function description(): string
    {
        return 'Per clinical domain, measures the fraction of records whose event date falls outside all observation periods for that person. Flags domains where >5% of records are out-of-window.';
    }

    public function severity(): string
    {
        return 'major';
    }

    public function flagThreshold(): ?float
    {
        return 0.05;
    } // flag if >5% out-of-window

    public function requiredTables(): array
    {
        return [
            'observation_period',
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
            'observation',
        ];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            -- Condition Occurrence
            SELECT
                'condition_occurrence'                                                  AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.condition_occurrence
                    WHERE condition_concept_id != 0)                                   AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.condition_occurrence
                                WHERE condition_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Condition records whose condition_start_date falls outside all observation periods' AS notes
            FROM {@cdmSchema}.condition_occurrence co
            WHERE co.condition_concept_id != 0
              AND NOT EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = co.person_id
                      AND co.condition_start_date BETWEEN op.observation_period_start_date
                                                      AND op.observation_period_end_date
              )

            UNION ALL

            -- Drug Exposure
            SELECT
                'drug_exposure'                                                         AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                    WHERE drug_concept_id != 0)                                        AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE drug_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposure records whose start_date falls outside all observation periods' AS notes
            FROM {@cdmSchema}.drug_exposure de
            WHERE de.drug_concept_id != 0
              AND NOT EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = de.person_id
                      AND de.drug_exposure_start_date BETWEEN op.observation_period_start_date
                                                          AND op.observation_period_end_date
              )

            UNION ALL

            -- Procedure Occurrence
            SELECT
                'procedure_occurrence'                                                  AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.procedure_occurrence
                    WHERE procedure_concept_id != 0)                                   AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.procedure_occurrence
                                WHERE procedure_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Procedure records whose procedure_date falls outside all observation periods' AS notes
            FROM {@cdmSchema}.procedure_occurrence po
            WHERE po.procedure_concept_id != 0
              AND NOT EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = po.person_id
                      AND po.procedure_date BETWEEN op.observation_period_start_date
                                               AND op.observation_period_end_date
              )

            UNION ALL

            -- Measurement
            SELECT
                'measurement'                                                           AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.measurement
                    WHERE measurement_concept_id != 0)                                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.measurement
                                WHERE measurement_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Measurement records whose measurement_date falls outside all observation periods' AS notes
            FROM {@cdmSchema}.measurement m
            WHERE m.measurement_concept_id != 0
              AND NOT EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = m.person_id
                      AND m.measurement_date BETWEEN op.observation_period_start_date
                                                 AND op.observation_period_end_date
              )

            UNION ALL

            -- Observation
            SELECT
                'observation'                                                           AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.observation
                    WHERE observation_concept_id != 0)                                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.observation
                                WHERE observation_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Observation records whose observation_date falls outside all observation periods' AS notes
            FROM {@cdmSchema}.observation ob
            WHERE ob.observation_concept_id != 0
              AND NOT EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.observation_period op
                    WHERE op.person_id = ob.person_id
                      AND ob.observation_date BETWEEN op.observation_period_start_date
                                                  AND op.observation_period_end_date
              )
            SQL;
    }
}
