-- Phase 3 Plan 1 Task 9: 837 → COST.
--
-- The Parthenon-specific commercial wedge — D2E doesn't ship this. See
-- ADR 0016 (claims_to_omop COST projection). Maps fmt_837_line amounts
-- (charged_amount, allowed_amount, paid_amount) to OMOP cost.cost rows
-- via the CostProjector convention:
--
--   * cost_event_field_concept_id = 1147301 (procedure_occurrence) at
--     the line level for ALL claim types.
--   * cost_event_field_concept_id = 1147300 (visit_occurrence) for 837I
--     header totals (charged + paid).
--   * cost_concept_id distinguishes the kind:
--       31968 — Total charged
--       31976 — Total allowed
--       31973 — Paid by payer
--   * currency_concept_id = 44818668 (USD; v0.1 hard-coded per ADR 0016).
--
-- The mapper emits one INSERT per amount kind. UNION ALL keeps the
-- statement set readable and lets PostgreSQL parallelize each branch.

-- Line-level COST rows ----------------------------------------------------

-- Charged: ALWAYS emitted (charged_amount is NOT NULL on fmt_837_line).
INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost,
    revenue_code_source_value
)
SELECT
    l.id AS cost_event_id,
    1147301 AS cost_event_field_concept_id,
    31968 AS cost_concept_id,
    44818668 AS currency_concept_id,
    l.charged_amount AS cost,
    l.revenue_code AS revenue_code_source_value
FROM ${parameters.source_schema}.fmt_837_line l;

-- Allowed: emitted only when the source has an 835-reconciled allowed
-- amount. NULL on the source means the claim hasn't been reconciled yet
-- (Plan 2's 835 reader will populate this column).
INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost,
    revenue_code_source_value
)
SELECT
    l.id AS cost_event_id,
    1147301 AS cost_event_field_concept_id,
    31976 AS cost_concept_id,
    44818668 AS currency_concept_id,
    l.allowed_amount AS cost,
    l.revenue_code AS revenue_code_source_value
FROM ${parameters.source_schema}.fmt_837_line l
WHERE l.allowed_amount IS NOT NULL;

-- Paid: emitted only when 835-reconciled.
INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost,
    revenue_code_source_value
)
SELECT
    l.id AS cost_event_id,
    1147301 AS cost_event_field_concept_id,
    31973 AS cost_concept_id,
    44818668 AS currency_concept_id,
    l.paid_amount AS cost,
    l.revenue_code AS revenue_code_source_value
FROM ${parameters.source_schema}.fmt_837_line l
WHERE l.paid_amount IS NOT NULL;

-- Visit-level COST rows for institutional (837I) claims -------------------
-- Per the CostProjector convention: P/D claims emit no header rows; I
-- claims emit charged + paid (allowed at the header is left to Plan 2's
-- 835 reconciliation, where the CAS adjudication codes give us the
-- header-level allowed total).

INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost
)
SELECT
    v.visit_occurrence_id AS cost_event_id,
    1147300 AS cost_event_field_concept_id,
    31968 AS cost_concept_id,
    44818668 AS currency_concept_id,
    c.total_charged AS cost
FROM ${parameters.source_schema}.fmt_837_claim c
JOIN ${parameters.cdm_schema}.visit_occurrence v ON v.visit_occurrence_id = c.id
WHERE c.claim_type = 'I';

INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost
)
SELECT
    v.visit_occurrence_id AS cost_event_id,
    1147300 AS cost_event_field_concept_id,
    31973 AS cost_concept_id,
    44818668 AS currency_concept_id,
    c.total_paid AS cost
FROM ${parameters.source_schema}.fmt_837_claim c
JOIN ${parameters.cdm_schema}.visit_occurrence v ON v.visit_occurrence_id = c.id
WHERE c.claim_type = 'I' AND c.total_paid IS NOT NULL;
