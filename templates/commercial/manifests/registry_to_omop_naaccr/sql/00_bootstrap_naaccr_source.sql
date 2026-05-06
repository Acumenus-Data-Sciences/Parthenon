-- Phase 3 Plan 4A Task 4 (T-022A): bootstrap fmt_naaccr_record source table.
--
-- Mirrors NAACCRRecord (templates/commercial/runtime/commercial/registry/
-- naaccr/types.py). One row per patient-tumor pair. The NAACCRReader
-- writes here via bulk COPY in production; the validation E2E populates
-- it via INSERT VALUES.
--
-- Ported from OHDSI/CdmEtlNaaccr (Apache-2.0, see ohdsi_pin.txt) and
-- re-targeted for PostgreSQL. Column names use NAACCR Item Names
-- (snake_case) for stability across NAACCR Layout versions.

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_naaccr_record (
    id BIGSERIAL PRIMARY KEY,
    -- Patient identity
    patient_id_number VARCHAR(20) NOT NULL,
    tumor_record_number INT NOT NULL CHECK (tumor_record_number >= 1),
    name_last VARCHAR(40),
    name_first VARCHAR(40),
    date_of_birth DATE NOT NULL,
    sex CHAR(1) NOT NULL,
    race_1 CHAR(2),
    spanish_hispanic_origin CHAR(1),
    -- Tumor diagnosis
    primary_site CHAR(4) NOT NULL,         -- ICD-O-3 topography (e.g. C509)
    histologic_type_icdo3 CHAR(4) NOT NULL, -- ICD-O-3 morphology
    behavior_code_icdo3 CHAR(1) NOT NULL CHECK (behavior_code_icdo3 IN ('0','1','2','3','6')),
    grade CHAR(1),
    date_of_diagnosis DATE NOT NULL,
    diagnostic_confirmation CHAR(1),
    -- AJCC staging
    ajcc_stage_group VARCHAR(8),
    ajcc_t VARCHAR(8),
    ajcc_n VARCHAR(8),
    ajcc_m VARCHAR(8),
    -- First-course treatment summary
    rx_summary_surgery VARCHAR(4),
    rx_summary_chemo VARCHAR(4),
    rx_summary_radiation VARCHAR(4),
    rx_summary_hormone VARCHAR(4),
    -- Outcome / follow-up
    vital_status CHAR(1),
    date_of_last_contact DATE,
    cause_of_death VARCHAR(8),
    -- Provenance
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (patient_id_number, tumor_record_number)
);

CREATE INDEX IF NOT EXISTS ix_fmt_naaccr_record_dx_date
    ON ${parameters.source_schema}.fmt_naaccr_record (date_of_diagnosis);

CREATE INDEX IF NOT EXISTS ix_fmt_naaccr_record_primary_site
    ON ${parameters.source_schema}.fmt_naaccr_record (primary_site);

CREATE INDEX IF NOT EXISTS ix_fmt_naaccr_record_histology
    ON ${parameters.source_schema}.fmt_naaccr_record (histologic_type_icdo3);
