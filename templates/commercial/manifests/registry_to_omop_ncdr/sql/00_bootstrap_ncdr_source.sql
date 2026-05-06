-- Phase 3 Plan 4C Task 4 (T-022C): bootstrap fmt_ncdr_pci source table.

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_ncdr_pci (
    id BIGSERIAL PRIMARY KEY,
    record_id VARCHAR(40) NOT NULL,
    patient_id VARCHAR(40) NOT NULL,
    procedure_date DATE NOT NULL,
    patient_age INT NOT NULL CHECK (patient_age BETWEEN 0 AND 120),
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F', 'U')),
    hospital_id VARCHAR(40) NOT NULL,
    operator_npi CHAR(10) NOT NULL,
    preop_diagnosis_icd10 VARCHAR(10) NOT NULL,
    ejection_fraction NUMERIC(5, 2) NOT NULL CHECK (ejection_fraction BETWEEN 0 AND 100),
    cardiac_index NUMERIC(5, 2) NOT NULL CHECK (cardiac_index BETWEEN 0 AND 10),
    lesion_count INT NOT NULL CHECK (lesion_count >= 0),
    lesion_segments TEXT[],
    primary_procedure_code VARCHAR(10) NOT NULL,
    stent_count INT NOT NULL CHECK (stent_count >= 0),
    stent_udis TEXT[],
    stent_types TEXT[],
    postop_bleeding BOOLEAN NOT NULL DEFAULT FALSE,
    postop_aki BOOLEAN NOT NULL DEFAULT FALSE,
    postop_stroke BOOLEAN NOT NULL DEFAULT FALSE,
    length_of_stay INT NOT NULL CHECK (length_of_stay >= 0),
    mortality_in_hospital BOOLEAN NOT NULL DEFAULT FALSE,
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (record_id),
    -- Reader enforces this; the DB also enforces so a bad direct INSERT fails.
    CHECK (cardinality(stent_udis) = cardinality(stent_types))
);

CREATE INDEX IF NOT EXISTS ix_fmt_ncdr_pci_date
    ON ${parameters.source_schema}.fmt_ncdr_pci (procedure_date);
