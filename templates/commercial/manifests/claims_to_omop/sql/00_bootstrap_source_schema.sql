-- Phase 3 Plan 1 Task 8: claims_source schema + fmt_837_claim / fmt_837_line
-- canonical tables. The X12_837_Reader writes into these via bulk COPY
-- (see 01_load_source_csv.sql for the loader contract).
--
-- Column shapes mirror X12_837_Claim and X12_837_ClaimLine in
-- runtime/commercial/claims/types.py. Surrogate BIGSERIAL primary keys
-- are used because (claim_id, line_number) is not globally unique across
-- multiple 837 files (different submitters can reuse claim_id values).

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_837_claim (
    id BIGSERIAL PRIMARY KEY,
    claim_id VARCHAR(50) NOT NULL,
    payer_id VARCHAR(80),
    submitter_id VARCHAR(80),
    receiver_id VARCHAR(80),
    subscriber_id VARCHAR(80),
    patient_id VARCHAR(80),
    claim_type CHAR(1) NOT NULL CHECK (claim_type IN ('P', 'I', 'D')),
    statement_date DATE NOT NULL,
    total_charged NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_paid NUMERIC(14, 2),
    diagnosis_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
    place_of_service VARCHAR(20),
    -- Provenance: which 837 file did this row come from? Helps the run
    -- report explain orphan claims and lets us re-load incrementally.
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fmt_837_claim_claim_id
    ON ${parameters.source_schema}.fmt_837_claim (claim_id);

CREATE INDEX IF NOT EXISTS ix_fmt_837_claim_statement_date
    ON ${parameters.source_schema}.fmt_837_claim (statement_date);

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_837_line (
    id BIGSERIAL PRIMARY KEY,
    claim_id VARCHAR(50) NOT NULL,
    line_number INTEGER NOT NULL CHECK (line_number >= 1),
    procedure_code VARCHAR(20) NOT NULL,
    procedure_modifiers TEXT[] DEFAULT ARRAY[]::TEXT[],
    service_date_from DATE NOT NULL,
    service_date_to DATE NOT NULL,
    units NUMERIC(12, 4) NOT NULL DEFAULT 0,
    charged_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    allowed_amount NUMERIC(14, 2),
    paid_amount NUMERIC(14, 2),
    diagnosis_pointers INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    -- Optional 4-digit revenue code (institutional only). Used by the
    -- COST projector to populate revenue_code_concept_id.
    revenue_code VARCHAR(8),
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (claim_id, line_number)
);

CREATE INDEX IF NOT EXISTS ix_fmt_837_line_claim_id
    ON ${parameters.source_schema}.fmt_837_line (claim_id);

CREATE INDEX IF NOT EXISTS ix_fmt_837_line_procedure_code
    ON ${parameters.source_schema}.fmt_837_line (procedure_code);
