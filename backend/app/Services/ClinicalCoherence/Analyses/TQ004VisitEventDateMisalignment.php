<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ004 – Visit-Event Date Misalignment
 *
 * When a clinical record has a visit_occurrence_id populated, its event date
 * should fall within the visit's start/end dates (with a 1-day tolerance for
 * timezone differences and same-day discharge documentation).
 *
 * Misalignment indicates:
 *  - Incorrect visit linkage during ETL
 *  - Date transposition errors
 *  - Copy-forward documentation (event date copied from a different encounter)
 *
 * Domains checked: condition_occurrence, drug_exposure,
 *                  procedure_occurrence, measurement
 */
class TQ004VisitEventDateMisalignment implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string { return 'TQ004'; }

    public function analysisName(): string
    {
        return 'Visit-Event Date Misalignment';
    }

    public function category(): string { return 'Temporal Quality'; }

    public function description(): string
    {
        return 'For records linked to a visit (visit_occurrence_id IS NOT NULL), checks that the event date falls within the visit start/end dates (±1 day tolerance). Misalignment suggests ETL linkage errors or date transposition.';
    }

    public function severity(): string { return 'major'; }

    public function flagThreshold(): ?float { return 0.05; } // flag if >5% of linked records are misaligned

    public function requiredTables(): array
    {
        return [
            'visit_occurrence',
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
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
                    WHERE visit_occurrence_id IS NOT NULL
                      AND condition_concept_id != 0)                                   AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.condition_occurrence
                                WHERE visit_occurrence_id IS NOT NULL
                                  AND condition_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Condition records whose start_date falls outside the linked visit dates (±1 day)' AS notes
            FROM {@cdmSchema}.condition_occurrence co
            JOIN {@cdmSchema}.visit_occurrence vo
                ON co.visit_occurrence_id = vo.visit_occurrence_id
            WHERE co.condition_concept_id != 0
              AND co.visit_occurrence_id IS NOT NULL
              AND (
                    co.condition_start_date < vo.visit_start_date - 1
                 OR co.condition_start_date > vo.visit_end_date + 1
              )
            HAVING COUNT(*) > 0

            UNION ALL

            -- Drug Exposure
            SELECT
                'drug_exposure'                                                         AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                    WHERE visit_occurrence_id IS NOT NULL
                      AND drug_concept_id != 0)                                        AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE visit_occurrence_id IS NOT NULL
                                  AND drug_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposure records whose start_date falls outside the linked visit dates (±1 day)' AS notes
            FROM {@cdmSchema}.drug_exposure de
            JOIN {@cdmSchema}.visit_occurrence vo
                ON de.visit_occurrence_id = vo.visit_occurrence_id
            WHERE de.drug_concept_id != 0
              AND de.visit_occurrence_id IS NOT NULL
              AND (
                    de.drug_exposure_start_date < vo.visit_start_date - 1
                 OR de.drug_exposure_start_date > vo.visit_end_date + 1
              )
            HAVING COUNT(*) > 0

            UNION ALL

            -- Procedure Occurrence
            SELECT
                'procedure_occurrence'                                                  AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.procedure_occurrence
                    WHERE visit_occurrence_id IS NOT NULL
                      AND procedure_concept_id != 0)                                   AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.procedure_occurrence
                                WHERE visit_occurrence_id IS NOT NULL
                                  AND procedure_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Procedure records whose date falls outside the linked visit dates (±1 day)' AS notes
            FROM {@cdmSchema}.procedure_occurrence po
            JOIN {@cdmSchema}.visit_occurrence vo
                ON po.visit_occurrence_id = vo.visit_occurrence_id
            WHERE po.procedure_concept_id != 0
              AND po.visit_occurrence_id IS NOT NULL
              AND (
                    po.procedure_date < vo.visit_start_date - 1
                 OR po.procedure_date > vo.visit_end_date + 1
              )
            HAVING COUNT(*) > 0

            UNION ALL

            -- Measurement
            SELECT
                'measurement'                                                           AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.measurement
                    WHERE visit_occurrence_id IS NOT NULL
                      AND measurement_concept_id != 0)                                 AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.measurement
                                WHERE visit_occurrence_id IS NOT NULL
                                  AND measurement_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Measurement records whose date falls outside the linked visit dates (±1 day)' AS notes
            FROM {@cdmSchema}.measurement m
            JOIN {@cdmSchema}.visit_occurrence vo
                ON m.visit_occurrence_id = vo.visit_occurrence_id
            WHERE m.measurement_concept_id != 0
              AND m.visit_occurrence_id IS NOT NULL
              AND (
                    m.measurement_date < vo.visit_start_date - 1
                 OR m.measurement_date > vo.visit_end_date + 1
              )
            HAVING COUNT(*) > 0
            SQL;
    }
}
