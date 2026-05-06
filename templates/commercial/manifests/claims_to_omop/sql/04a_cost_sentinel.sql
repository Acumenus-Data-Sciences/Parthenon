-- Phase 3 Plan 1 Task 10: cost-sentinel artifact for the validation pack.
--
-- Returns one row per (claim_type, cost_event_field_concept_id,
-- cost_concept_id) tuple with the row count and SUM(cost). The E2E
-- compares this against validation/expected/cost_sentinels.csv.

SELECT
    c.claim_type,
    cost.cost_event_field_concept_id,
    cost.cost_concept_id,
    COUNT(*) AS row_count,
    SUM(cost.cost) AS total_amount
FROM ${parameters.cdm_schema}.cost cost
LEFT JOIN ${parameters.cdm_schema}.procedure_occurrence po
    ON cost.cost_event_field_concept_id = 1147301
    AND cost.cost_event_id = po.procedure_occurrence_id
LEFT JOIN ${parameters.cdm_schema}.visit_occurrence v
    ON v.visit_occurrence_id = COALESCE(po.visit_occurrence_id, cost.cost_event_id)
LEFT JOIN ${parameters.source_schema}.fmt_837_claim c
    ON c.id = v.visit_occurrence_id
GROUP BY c.claim_type, cost.cost_event_field_concept_id, cost.cost_concept_id
ORDER BY c.claim_type, cost.cost_event_field_concept_id, cost.cost_concept_id;
