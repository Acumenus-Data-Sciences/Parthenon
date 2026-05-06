-- Phase 3 Plan 3 Tasks 4 + 7 (T-021C): bootstrap fmt_ncpdp_claim source table.
--
-- Mirrors NCPDPClaim (templates/commercial/runtime/commercial/claims/types.py).
-- One row per NCPDP D.0 transaction (B1 billing, B2 reversal, B3 rebill).
-- The NCPDPReader writes here via bulk COPY in production; the validation
-- E2E populates it via INSERT VALUES.
--
-- DRUG_EXPOSURE projection happens in 03a_map_drug_exposure.sql, joining
-- ndc_code against vocab.concept + concept_relationship 'Maps to' to get
-- the standard RxNorm concept_id.

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_ncpdp_claim (
    id BIGSERIAL PRIMARY KEY,
    transaction_code CHAR(2) NOT NULL CHECK (transaction_code IN ('B1', 'B2', 'B3')),
    bin_number VARCHAR(10) NOT NULL,
    processor_control_number VARCHAR(20) NOT NULL,
    pharmacy_npi CHAR(10) NOT NULL,
    cardholder_id VARCHAR(80) NOT NULL,  -- de-identified or hashed; HIGHSEC §7
    date_of_service DATE NOT NULL,
    ndc_code CHAR(11) NOT NULL,
    days_supply INT NOT NULL CHECK (days_supply >= 0),
    quantity_dispensed NUMERIC(14, 2) NOT NULL CHECK (quantity_dispensed >= 0),
    ingredient_cost NUMERIC(14, 2) NOT NULL CHECK (ingredient_cost >= 0),
    dispensing_fee NUMERIC(14, 2) NOT NULL CHECK (dispensing_fee >= 0),
    patient_paid_amount NUMERIC(14, 2) NOT NULL CHECK (patient_paid_amount >= 0),
    is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
    -- Provenance.
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_fmt_ncpdp_claim_ndc
    ON ${parameters.source_schema}.fmt_ncpdp_claim (ndc_code);

CREATE INDEX IF NOT EXISTS ix_fmt_ncpdp_claim_pharmacy_npi
    ON ${parameters.source_schema}.fmt_ncpdp_claim (pharmacy_npi);

CREATE INDEX IF NOT EXISTS ix_fmt_ncpdp_claim_date
    ON ${parameters.source_schema}.fmt_ncpdp_claim (date_of_service);

-- Unmapped-NDC log table — handed off to T-024 ai_assisted_mapping in Plan 6.
-- Lives in the application schema (not source/CDM) because it's operational
-- telemetry, not clinical data.

CREATE SCHEMA IF NOT EXISTS ${parameters.app_schema};

CREATE TABLE IF NOT EXISTS ${parameters.app_schema}.unmapped_ndc (
    id BIGSERIAL PRIMARY KEY,
    ndc_code CHAR(11) NOT NULL,
    -- Distinct example fmt_ncpdp_claim.id values for this NDC (capped at 5
    -- via the mapper SQL) so reviewers can sample real cases.
    example_claim_ids BIGINT[],
    -- How many unique pharmacy_npis dispensed this NDC — useful signal for
    -- whether the gap is one bad pharmacy or a systematic mapping miss.
    pharmacy_count INT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ndc_code)
);

CREATE INDEX IF NOT EXISTS ix_unmapped_ndc_first_seen
    ON ${parameters.app_schema}.unmapped_ndc (first_seen_at);
