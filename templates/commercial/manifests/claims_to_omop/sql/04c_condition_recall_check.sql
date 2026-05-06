-- Phase 3 Plan 1 Task 10: condition recall sentinel.
--
-- Asserts the diagnosis_codes array unnest landed every dx code as a
-- condition_occurrence row. Returns one row per claim with
-- (expected_dx_count, actual_condition_count). The E2E asserts the two
-- counts agree per claim.

SELECT
    c.claim_id,
    COALESCE(array_length(c.diagnosis_codes, 1), 0) AS expected_dx_count,
    (
        SELECT COUNT(*)
        FROM ${parameters.cdm_schema}.condition_occurrence co
        WHERE co.visit_occurrence_id = c.id
    ) AS actual_condition_count
FROM ${parameters.source_schema}.fmt_837_claim c
ORDER BY c.claim_id;
