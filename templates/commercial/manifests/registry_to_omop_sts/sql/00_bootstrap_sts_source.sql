-- Phase 3 Plan 4B Task 4 (T-022B): bootstrap fmt_sts_surgery source table.
-- Mirrors STSRecord (templates/commercial/runtime/commercial/registry/sts/types.py).

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_sts_surgery (
    id BIGSERIAL PRIMARY KEY,
    record_id VARCHAR(40) NOT NULL,
    patient_id VARCHAR(40) NOT NULL,
    surgery_date DATE NOT NULL,
    patient_age INT NOT NULL CHECK (patient_age BETWEEN 0 AND 120),
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F', 'U')),
    hospital_id VARCHAR(40) NOT NULL,
    surgeon_id VARCHAR(40) NOT NULL,
    ejection_fraction NUMERIC(5, 2) NOT NULL CHECK (ejection_fraction BETWEEN 0 AND 100),
    nyha_class INT NOT NULL CHECK (nyha_class BETWEEN 1 AND 4),
    primary_diagnosis_icd10 VARCHAR(10) NOT NULL,
    secondary_diagnoses_icd10 TEXT[],
    procedure_category VARCHAR(20) NOT NULL CHECK (procedure_category IN ('CABG', 'Valve', 'Aortic', 'Combined', 'Other')),
    primary_procedure_code VARCHAR(10) NOT NULL,
    secondary_procedure_codes TEXT[],
    postop_aki BOOLEAN NOT NULL DEFAULT FALSE,
    postop_stroke BOOLEAN NOT NULL DEFAULT FALSE,
    postop_reoperation BOOLEAN NOT NULL DEFAULT FALSE,
    postop_sepsis BOOLEAN NOT NULL DEFAULT FALSE,
    length_of_stay INT NOT NULL CHECK (length_of_stay >= 0),
    discharge_disposition VARCHAR(40) NOT NULL,
    mortality_30day BOOLEAN NOT NULL DEFAULT FALSE,
    source_file VARCHAR(512),
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (record_id)
);

CREATE INDEX IF NOT EXISTS ix_fmt_sts_surgery_date
    ON ${parameters.source_schema}.fmt_sts_surgery (surgery_date);

CREATE INDEX IF NOT EXISTS ix_fmt_sts_surgery_proc
    ON ${parameters.source_schema}.fmt_sts_surgery (procedure_category);
