-- Phase 3 Plan 2 Task 6 (T-021B): reconcile 835 remits onto Plan 1 COST rows.
--
-- This stage is the SQL realization of ``RemitReconciler.reconcile()``
-- (templates/commercial/runtime/commercial/claims/remit_reconciler.py).
-- It runs in four passes, each idempotent on re-runs of the same
-- (run_id, fmt_835_remit) snapshot:
--
--   1. ORPHAN: any remit with no matching (payer_id, claim_id) in
--      fmt_837_claim → row in app.remit_orphans.
--   2. UPDATE source: matched non-reversal remits backfill
--      fmt_837_line.allowed_amount / paid_amount. The source-of-truth
--      change makes the COST table emission in step 3 symmetric with
--      Plan 1's 02d_project_cost.sql.
--   3. INSERT cost rows: emit the OMOP COST allowed (31976) and paid
--      (31973) rows for matched non-reversal remits where the cost row
--      doesn't already exist (idempotency).
--   4. INSERT compensations: matched reversal remits emit a NEW COST
--      row with the negated paid amount, leaving the original untouched
--      (idempotency for re-runs that include the same reversal).
--
-- Conventions (ADR 0016 §"Remit reconciliation"):
--   * cost_event_field_concept_id = 1147301 (procedure_occurrence)
--   * Reversal compensation rows use the SAME cost_concept_id (31973
--     "Paid by payer") with a negative cost; HEOR queries SUM(cost) net
--     to the post-reversal paid amount automatically.
--   * orphan rows carry run_id so operators can replay if a late claim
--     arrives.

-- Pass 1: orphan log ------------------------------------------------------

INSERT INTO ${parameters.app_schema}.remit_orphans (
    payer_id,
    claim_id,
    line_number,
    procedure_code,
    paid_amount,
    paid_date,
    run_id
)
SELECT
    r.payer_id,
    r.claim_id,
    r.line_number,
    r.procedure_code,
    r.paid_amount,
    r.paid_date,
    '${parameters.run_id}' AS run_id
FROM ${parameters.source_schema}.fmt_835_remit r
LEFT JOIN ${parameters.source_schema}.fmt_837_claim c
    ON c.payer_id = r.payer_id AND c.claim_id = r.claim_id
WHERE c.id IS NULL;

-- Pass 2: backfill fmt_837_line.allowed/paid from non-reversal remits ---

UPDATE ${parameters.source_schema}.fmt_837_line l
SET
    allowed_amount = r.allowed_amount,
    paid_amount = r.paid_amount
FROM ${parameters.source_schema}.fmt_835_remit r
JOIN ${parameters.source_schema}.fmt_837_claim c
    ON c.payer_id = r.payer_id AND c.claim_id = r.claim_id
WHERE l.claim_id = r.claim_id
  AND l.line_number = r.line_number
  AND r.is_reversal = FALSE;

-- Pass 3: emit allowed (31976) + paid (31973) COST rows for matched lines.
-- The NOT EXISTS clause makes the INSERT idempotent — if 02f runs twice
-- for the same data, the second run is a no-op.

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
WHERE l.allowed_amount IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM ${parameters.cdm_schema}.cost x
      WHERE x.cost_event_id = l.id
        AND x.cost_event_field_concept_id = 1147301
        AND x.cost_concept_id = 31976
  );

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
WHERE l.paid_amount IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM ${parameters.cdm_schema}.cost x
      WHERE x.cost_event_id = l.id
        AND x.cost_event_field_concept_id = 1147301
        AND x.cost_concept_id = 31973
  );

-- Pass 4: emit compensating COST rows for reversal remits (CLP02 = 22).
-- These are NEW rows with negated paid amounts — the original COST row
-- stays put. SUM(cost) over the (cost_event_id, cost_concept_id=31973)
-- partition naturally nets to the post-reversal paid amount.
--
-- We use cost_source_value = 'remit_reversal' as the marker so HEOR
-- queries can filter compensation rows in/out as needed. Idempotency:
-- WHERE the (cost_event_id, marker, paid_date) tuple isn't already
-- present.

INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost,
    cost_source_value
)
SELECT
    l.id AS cost_event_id,
    1147301 AS cost_event_field_concept_id,
    31973 AS cost_concept_id,
    44818668 AS currency_concept_id,
    r.paid_amount AS cost,  -- already signed negative on the wire
    'remit_reversal' AS cost_source_value
FROM ${parameters.source_schema}.fmt_835_remit r
JOIN ${parameters.source_schema}.fmt_837_claim c
    ON c.payer_id = r.payer_id AND c.claim_id = r.claim_id
JOIN ${parameters.source_schema}.fmt_837_line l
    ON l.claim_id = r.claim_id AND l.line_number = r.line_number
WHERE r.is_reversal = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM ${parameters.cdm_schema}.cost x
      WHERE x.cost_event_id = l.id
        AND x.cost_event_field_concept_id = 1147301
        AND x.cost_concept_id = 31973
        AND x.cost = r.paid_amount
        AND x.cost_source_value = 'remit_reversal'
  );
