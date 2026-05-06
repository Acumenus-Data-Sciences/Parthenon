-- Phase 3 Plan 1 Task 8: bulk-load contract for the X12_837_Reader.
--
-- The reader serializes parsed claims/lines to CSV and the runner uses
-- this SQL to bulk-COPY them into ${parameters.source_schema}. The
-- ${csv_path_claims} and ${csv_path_lines} parameters are bound by the
-- runner from the reader node's outputs (see nodes/x12_837_reader.py
-- in Plan 2's wire-up).
--
-- We use COPY ... FROM STDIN here so the runner can stream large
-- payloads without staging files on disk. The PostgreSQL psycopg
-- adapter exposes COPY via cursor.copy_expert().
--
-- NB: column lists match the fmt_837_claim / fmt_837_line schemas from
-- 00_bootstrap_source_schema.sql, EXCLUDING the BIGSERIAL id and
-- loaded_at default.

COPY ${parameters.source_schema}.fmt_837_claim (
    claim_id,
    payer_id,
    submitter_id,
    receiver_id,
    subscriber_id,
    patient_id,
    claim_type,
    statement_date,
    total_charged,
    total_paid,
    diagnosis_codes,
    place_of_service,
    source_file
)
FROM STDIN WITH (FORMAT csv, HEADER true);

COPY ${parameters.source_schema}.fmt_837_line (
    claim_id,
    line_number,
    procedure_code,
    procedure_modifiers,
    service_date_from,
    service_date_to,
    units,
    charged_amount,
    allowed_amount,
    paid_amount,
    diagnosis_pointers,
    revenue_code,
    source_file
)
FROM STDIN WITH (FORMAT csv, HEADER true);
