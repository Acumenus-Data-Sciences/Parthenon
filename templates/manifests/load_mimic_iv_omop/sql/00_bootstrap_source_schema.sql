-- Phase 2 Plan 4 Task 1: mimic_iv_source schema + raw fmt_* tables.
-- Column types match MIMIC-IV's mimiciv Postgres dump conventions.
-- All hadm_id / subject_id / stay_id are BIGINT per OHDSI ETL convention.

CREATE SCHEMA IF NOT EXISTS mimic_iv_source;

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_patients (
    subject_id BIGINT PRIMARY KEY,
    gender CHAR(1),
    anchor_age INT,
    anchor_year INT,
    anchor_year_group VARCHAR(20),
    dod DATE
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_admissions (
    hadm_id BIGINT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    admittime TIMESTAMP NOT NULL,
    dischtime TIMESTAMP,
    deathtime TIMESTAMP,
    admission_type VARCHAR(50),
    admission_location VARCHAR(50),
    discharge_location VARCHAR(50),
    insurance VARCHAR(255),
    language VARCHAR(20),
    marital_status VARCHAR(50),
    race VARCHAR(80),
    edregtime TIMESTAMP,
    edouttime TIMESTAMP,
    hospital_expire_flag SMALLINT
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_transfers (
    transfer_id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT,
    eventtype VARCHAR(20),
    careunit VARCHAR(50),
    intime TIMESTAMP NOT NULL,
    outtime TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_diagnoses_icd (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT NOT NULL,
    seq_num INT NOT NULL,
    icd_code VARCHAR(10) NOT NULL,
    icd_version SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_procedures_icd (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT NOT NULL,
    seq_num INT NOT NULL,
    chartdate DATE,
    icd_code VARCHAR(10) NOT NULL,
    icd_version SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_labevents (
    labevent_id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT,
    specimen_id BIGINT,
    itemid BIGINT NOT NULL,
    charttime TIMESTAMP,
    storetime TIMESTAMP,
    value VARCHAR(200),
    valuenum NUMERIC,
    valueuom VARCHAR(20),
    ref_range_lower NUMERIC,
    ref_range_upper NUMERIC,
    flag VARCHAR(20),
    priority VARCHAR(10),
    comments TEXT,
    loinc_code VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_prescriptions (
    pharmacy_id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT,
    starttime TIMESTAMP,
    stoptime TIMESTAMP,
    drug_type VARCHAR(20),
    drug VARCHAR(200),
    formulary_drug_cd VARCHAR(50),
    gsn VARCHAR(50),
    ndc VARCHAR(20),
    prod_strength VARCHAR(100),
    dose_val_rx VARCHAR(50),
    dose_unit_rx VARCHAR(20),
    route VARCHAR(20),
    rxnorm_code VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_chartevents (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT,
    stay_id BIGINT,
    charttime TIMESTAMP NOT NULL,
    itemid BIGINT NOT NULL,
    value VARCHAR(200),
    valuenum NUMERIC,
    valueuom VARCHAR(20),
    warning SMALLINT
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_noteevents (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT,
    chartdate DATE,
    charttime TIMESTAMP,
    storetime TIMESTAMP,
    category VARCHAR(50),
    description VARCHAR(255),
    cgid INT,
    iserror SMALLINT,
    text TEXT
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_drgcodes (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT NOT NULL,
    drg_type VARCHAR(20),
    drg_code VARCHAR(20),
    description VARCHAR(255),
    drg_severity SMALLINT,
    drg_mortality SMALLINT
);

CREATE TABLE IF NOT EXISTS mimic_iv_source.fmt_icustays (
    stay_id BIGINT PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    hadm_id BIGINT NOT NULL,
    first_careunit VARCHAR(50),
    last_careunit VARCHAR(50),
    intime TIMESTAMP NOT NULL,
    outtime TIMESTAMP,
    los NUMERIC
);
