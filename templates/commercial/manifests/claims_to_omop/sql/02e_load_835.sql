-- Phase 3 Plan 2 Task 6 + Task 8 (T-021B): bootstrap fmt_835_remit source table.
--
-- Mirrors X12_835_RemitItem (templates/commercial/runtime/commercial/claims/types.py).
-- One row per CLP/SVC loop pair — the X12_835_Reader writes here via bulk
-- COPY in production; the validation E2E populates it via INSERT VALUES.
--
-- Joins onto Plan 1's COST rows via (payer_id, claim_id, line_number) —
-- the same triple ``RemitReconciler.reconcile()`` matches on in-process.

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_835_remit (
    id BIGSERIAL PRIMARY KEY,
    payer_id VARCHAR(80) NOT NULL,
    claim_id VARCHAR(50) NOT NULL,
    line_number INT NOT NULL CHECK (line_number >= 1),
    procedure_code VARCHAR(20),
    -- Amounts allow negatives for reversal remits (CLP02 = '22').
    charged_amount NUMERIC(14, 2) NOT NULL,
    paid_amount NUMERIC(14, 2) NOT NULL,
    allowed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    -- CAS triples (group_code, reason_code, amount) serialized as JSONB
    -- so the reconciler can carry them onto cost.cost_source_value for
    -- downstream HEOR analysis.
    adjustment_codes JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    paid_date DATE,
    -- Provenance + idempotency.
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fmt_835_remit_match_key
    ON ${parameters.source_schema}.fmt_835_remit (payer_id, claim_id, line_number);

CREATE INDEX IF NOT EXISTS ix_fmt_835_remit_paid_date
    ON ${parameters.source_schema}.fmt_835_remit (paid_date);

-- Orphan log table — one row per remit with no matching claim line. Lives
-- in the application schema (NOT the source/CDM schema) because it's
-- operational telemetry, not clinical or claims data.

CREATE SCHEMA IF NOT EXISTS ${parameters.app_schema};

CREATE TABLE IF NOT EXISTS ${parameters.app_schema}.remit_orphans (
    id BIGSERIAL PRIMARY KEY,
    payer_id VARCHAR(80) NOT NULL,
    claim_id VARCHAR(50) NOT NULL,
    line_number INT NOT NULL,
    procedure_code VARCHAR(20),
    paid_amount NUMERIC(14, 2) NOT NULL,
    paid_date DATE,
    -- The run_id that detected the orphan; lets operators correlate
    -- against the run-book artifacts and replay if a late claim arrives.
    run_id VARCHAR(64),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_remit_orphans_claim_id
    ON ${parameters.app_schema}.remit_orphans (claim_id);
