-- Phase 3 Plan 1 Task 10: aggregate validation result.
--
-- Reads the three sentinel artifacts and returns a single status row.
-- The runner stores this as ``claims_to_omop_validation.json`` and the
-- post_conditions in manifest.yaml gate the run on its presence.

WITH cost_totals AS (
    SELECT
        SUM(row_count) AS total_cost_rows,
        SUM(CASE WHEN cost_concept_id = 31968 THEN row_count ELSE 0 END) AS charged_rows,
        SUM(CASE WHEN cost_concept_id = 31976 THEN row_count ELSE 0 END) AS allowed_rows,
        SUM(CASE WHEN cost_concept_id = 31973 THEN row_count ELSE 0 END) AS paid_rows
    FROM (
        SELECT
            cost.cost_concept_id,
            COUNT(*) AS row_count
        FROM ${parameters.cdm_schema}.cost cost
        GROUP BY cost.cost_concept_id
    ) sub
),
orphan AS (
    SELECT COUNT(*) AS orphans
    FROM ${parameters.cdm_schema}.procedure_occurrence po
    WHERE NOT EXISTS (
        SELECT 1 FROM ${parameters.cdm_schema}.cost c
        WHERE c.cost_event_field_concept_id = 1147301
          AND c.cost_event_id = po.procedure_occurrence_id
    )
)
SELECT
    cost_totals.total_cost_rows,
    cost_totals.charged_rows,
    cost_totals.allowed_rows,
    cost_totals.paid_rows,
    orphan.orphans AS orphan_procedure_count,
    CASE WHEN orphan.orphans = 0 THEN 'PASS' ELSE 'FAIL' END AS overall_status
FROM cost_totals, orphan;
