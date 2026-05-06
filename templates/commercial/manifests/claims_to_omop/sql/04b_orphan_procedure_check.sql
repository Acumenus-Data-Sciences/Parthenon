-- Phase 3 Plan 1 Task 10: orphan procedure_occurrence check.
--
-- Acceptance: every procedure_occurrence row MUST have at least one
-- corresponding cost row (cost_event_field_concept_id = 1147301,
-- cost_event_id = procedure_occurrence_id). Returns the count of
-- orphans; the E2E asserts this is zero.

SELECT
    COUNT(*) AS orphan_procedure_count
FROM ${parameters.cdm_schema}.procedure_occurrence po
WHERE NOT EXISTS (
    SELECT 1
    FROM ${parameters.cdm_schema}.cost c
    WHERE c.cost_event_field_concept_id = 1147301
      AND c.cost_event_id = po.procedure_occurrence_id
);
