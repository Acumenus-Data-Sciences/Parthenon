-- Phase 2 Plan 6 Task 12: bootstrap the per-source CDM schema with the 8 tables
-- this template writes. Uses CDM v5.4 column shape.

CREATE SCHEMA IF NOT EXISTS ${parameters.cdm_schema};

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.location (
    location_id BIGSERIAL PRIMARY KEY,
    address_1 VARCHAR(50),
    city VARCHAR(50),
    state CHAR(2),
    zip VARCHAR(9),
    country_concept_id INTEGER,
    country_source_value VARCHAR(80),
    location_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.person (
    person_id BIGSERIAL PRIMARY KEY,
    gender_concept_id INTEGER NOT NULL,
    year_of_birth INT NOT NULL,
    race_concept_id INTEGER NOT NULL,
    ethnicity_concept_id INTEGER NOT NULL,
    location_id BIGINT,
    person_source_value VARCHAR(50),
    gender_source_value VARCHAR(50),
    race_source_value VARCHAR(80),
    ethnicity_source_value VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.condition_occurrence (
    condition_occurrence_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    condition_concept_id INTEGER NOT NULL,
    condition_start_date DATE NOT NULL,
    condition_end_date DATE,
    condition_type_concept_id INTEGER,
    condition_source_value VARCHAR(255),
    condition_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.drug_exposure (
    drug_exposure_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    drug_concept_id INTEGER NOT NULL,
    drug_exposure_start_date DATE NOT NULL,
    drug_exposure_end_date DATE,
    drug_type_concept_id INTEGER,
    quantity NUMERIC,
    drug_source_value VARCHAR(255),
    dose_unit_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.measurement (
    measurement_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    measurement_concept_id INTEGER NOT NULL,
    measurement_date DATE NOT NULL,
    measurement_type_concept_id INTEGER,
    value_as_number NUMERIC,
    unit_concept_id INTEGER,
    range_low NUMERIC,
    range_high NUMERIC,
    measurement_source_value VARCHAR(50),
    unit_source_value VARCHAR(50),
    value_source_value VARCHAR(50)
);
