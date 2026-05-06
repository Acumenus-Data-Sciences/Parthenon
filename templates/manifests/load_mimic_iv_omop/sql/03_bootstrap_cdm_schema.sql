-- Phase 2 Plan 4 Task 4: bootstrap mimic_iv CDM schema with the 13 OMOP v5.4
-- tables this template writes. Column shape matches CDM v5.4 DDL exactly
-- (see github.com/OHDSI/CommonDataModel for canonical SQL).

CREATE SCHEMA IF NOT EXISTS ${parameters.target_schema};

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.person (
    person_id BIGINT PRIMARY KEY,
    gender_concept_id INTEGER NOT NULL,
    year_of_birth INT NOT NULL,
    month_of_birth INT,
    day_of_birth INT,
    birth_datetime TIMESTAMP,
    race_concept_id INTEGER NOT NULL,
    ethnicity_concept_id INTEGER NOT NULL,
    location_id BIGINT,
    provider_id BIGINT,
    care_site_id BIGINT,
    person_source_value VARCHAR(50),
    gender_source_value VARCHAR(50),
    gender_source_concept_id INTEGER,
    race_source_value VARCHAR(50),
    race_source_concept_id INTEGER,
    ethnicity_source_value VARCHAR(50),
    ethnicity_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.death (
    person_id BIGINT PRIMARY KEY,
    death_date DATE NOT NULL,
    death_datetime TIMESTAMP,
    death_type_concept_id INTEGER,
    cause_concept_id INTEGER,
    cause_source_value VARCHAR(50),
    cause_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.location (
    location_id BIGSERIAL PRIMARY KEY,
    address_1 VARCHAR(50),
    address_2 VARCHAR(50),
    city VARCHAR(50),
    state CHAR(2),
    zip VARCHAR(9),
    county VARCHAR(20),
    location_source_value VARCHAR(50),
    country_concept_id INTEGER,
    country_source_value VARCHAR(80),
    latitude NUMERIC,
    longitude NUMERIC
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.care_site (
    care_site_id BIGSERIAL PRIMARY KEY,
    care_site_name VARCHAR(255),
    place_of_service_concept_id INTEGER,
    location_id BIGINT,
    care_site_source_value VARCHAR(50),
    place_of_service_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.provider (
    provider_id BIGSERIAL PRIMARY KEY,
    provider_name VARCHAR(255),
    npi VARCHAR(20),
    dea VARCHAR(20),
    specialty_concept_id INTEGER,
    care_site_id BIGINT,
    year_of_birth INT,
    gender_concept_id INTEGER,
    provider_source_value VARCHAR(50),
    specialty_source_value VARCHAR(50),
    specialty_source_concept_id INTEGER,
    gender_source_value VARCHAR(50),
    gender_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.visit_occurrence (
    visit_occurrence_id BIGINT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    visit_concept_id INTEGER NOT NULL,
    visit_start_date DATE NOT NULL,
    visit_start_datetime TIMESTAMP,
    visit_end_date DATE NOT NULL,
    visit_end_datetime TIMESTAMP,
    visit_type_concept_id INTEGER,
    provider_id BIGINT,
    care_site_id BIGINT,
    visit_source_value VARCHAR(50),
    visit_source_concept_id INTEGER,
    admitted_from_concept_id INTEGER,
    admitted_from_source_value VARCHAR(50),
    discharged_to_concept_id INTEGER,
    discharged_to_source_value VARCHAR(50),
    preceding_visit_occurrence_id BIGINT
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.visit_detail (
    visit_detail_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    visit_detail_concept_id INTEGER NOT NULL,
    visit_detail_start_date DATE NOT NULL,
    visit_detail_start_datetime TIMESTAMP,
    visit_detail_end_date DATE NOT NULL,
    visit_detail_end_datetime TIMESTAMP,
    visit_detail_type_concept_id INTEGER,
    provider_id BIGINT,
    care_site_id BIGINT,
    visit_detail_source_value VARCHAR(50),
    visit_detail_source_concept_id INTEGER,
    admitted_from_concept_id INTEGER,
    admitted_from_source_value VARCHAR(50),
    discharged_to_concept_id INTEGER,
    discharged_to_source_value VARCHAR(50),
    preceding_visit_detail_id BIGINT,
    parent_visit_detail_id BIGINT,
    visit_occurrence_id BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.condition_occurrence (
    condition_occurrence_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    condition_concept_id INTEGER NOT NULL,
    condition_start_date DATE NOT NULL,
    condition_start_datetime TIMESTAMP,
    condition_end_date DATE,
    condition_end_datetime TIMESTAMP,
    condition_type_concept_id INTEGER,
    condition_status_concept_id INTEGER,
    stop_reason VARCHAR(20),
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    condition_source_value VARCHAR(50),
    condition_source_concept_id INTEGER,
    condition_status_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.procedure_occurrence (
    procedure_occurrence_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    procedure_concept_id INTEGER NOT NULL,
    procedure_date DATE NOT NULL,
    procedure_datetime TIMESTAMP,
    procedure_end_date DATE,
    procedure_end_datetime TIMESTAMP,
    procedure_type_concept_id INTEGER,
    modifier_concept_id INTEGER,
    quantity INTEGER,
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    procedure_source_value VARCHAR(50),
    procedure_source_concept_id INTEGER,
    modifier_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.measurement (
    measurement_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    measurement_concept_id INTEGER NOT NULL,
    measurement_date DATE NOT NULL,
    measurement_datetime TIMESTAMP,
    measurement_time VARCHAR(10),
    measurement_type_concept_id INTEGER,
    operator_concept_id INTEGER,
    value_as_number NUMERIC,
    value_as_concept_id INTEGER,
    unit_concept_id INTEGER,
    range_low NUMERIC,
    range_high NUMERIC,
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    measurement_source_value VARCHAR(50),
    measurement_source_concept_id INTEGER,
    unit_source_value VARCHAR(50),
    unit_source_concept_id INTEGER,
    value_source_value VARCHAR(50),
    measurement_event_id BIGINT,
    meas_event_field_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.drug_exposure (
    drug_exposure_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    drug_concept_id INTEGER NOT NULL,
    drug_exposure_start_date DATE NOT NULL,
    drug_exposure_start_datetime TIMESTAMP,
    drug_exposure_end_date DATE,
    drug_exposure_end_datetime TIMESTAMP,
    verbatim_end_date DATE,
    drug_type_concept_id INTEGER,
    stop_reason VARCHAR(20),
    refills INTEGER,
    quantity NUMERIC,
    days_supply INTEGER,
    sig TEXT,
    route_concept_id INTEGER,
    lot_number VARCHAR(50),
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    drug_source_value VARCHAR(50),
    drug_source_concept_id INTEGER,
    route_source_value VARCHAR(50),
    dose_unit_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.observation (
    observation_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    observation_concept_id INTEGER NOT NULL,
    observation_date DATE NOT NULL,
    observation_datetime TIMESTAMP,
    observation_type_concept_id INTEGER,
    value_as_number NUMERIC,
    value_as_string VARCHAR(255),
    value_as_concept_id INTEGER,
    qualifier_concept_id INTEGER,
    unit_concept_id INTEGER,
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    observation_source_value VARCHAR(50),
    observation_source_concept_id INTEGER,
    unit_source_value VARCHAR(50),
    qualifier_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.target_schema}.note (
    note_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    note_event_id BIGINT,
    note_event_field_concept_id INTEGER,
    note_date DATE NOT NULL,
    note_datetime TIMESTAMP,
    note_type_concept_id INTEGER NOT NULL,
    note_class_concept_id INTEGER NOT NULL,
    note_title VARCHAR(255),
    note_text TEXT,
    encoding_concept_id INTEGER NOT NULL,
    language_concept_id INTEGER NOT NULL,
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    note_source_value VARCHAR(50)
);
