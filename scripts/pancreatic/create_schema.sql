-- Pancreatic Corpus CDM Schema Creation
-- OMOP CDM v5.4 clinical tables only — vocabulary shared from vocab schema via search_path
-- Run as: psql -h localhost -U claude_dev -d parthenon -f create_schema.sql

BEGIN;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS pancreas;
CREATE SCHEMA IF NOT EXISTS pancreas_results;

-- Grant permissions to smudoshi (host PG17 — no parthenon role)
GRANT USAGE ON SCHEMA pancreas TO smudoshi;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pancreas TO smudoshi;
ALTER DEFAULT PRIVILEGES IN SCHEMA pancreas GRANT ALL ON TABLES TO smudoshi;

GRANT USAGE ON SCHEMA pancreas_results TO smudoshi;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pancreas_results TO smudoshi;
ALTER DEFAULT PRIVILEGES IN SCHEMA pancreas_results GRANT ALL ON TABLES TO smudoshi;

-- ============================================================
-- CDM SOURCE
-- ============================================================
CREATE TABLE IF NOT EXISTS pancreas.cdm_source (
    cdm_source_name varchar(255) NOT NULL,
    cdm_source_abbreviation varchar(25) NOT NULL,
    cdm_holder varchar(255) NOT NULL,
    source_description TEXT NULL,
    source_documentation_reference varchar(255) NULL,
    cdm_etl_reference varchar(255) NULL,
    source_release_date date NOT NULL,
    cdm_release_date date NOT NULL,
    cdm_version varchar(10) NULL,
    cdm_version_concept_id integer NOT NULL,
    vocabulary_version varchar(20) NOT NULL
);

-- ============================================================
-- CLINICAL DATA TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS pancreas.person (
    person_id integer NOT NULL,
    gender_concept_id integer NOT NULL,
    year_of_birth integer NOT NULL,
    month_of_birth integer NULL,
    day_of_birth integer NULL,
    birth_datetime TIMESTAMP NULL,
    race_concept_id integer NOT NULL,
    ethnicity_concept_id integer NOT NULL,
    location_id integer NULL,
    provider_id integer NULL,
    care_site_id integer NULL,
    person_source_value varchar(50) NULL,
    gender_source_value varchar(50) NULL,
    gender_source_concept_id integer NULL,
    race_source_value varchar(50) NULL,
    race_source_concept_id integer NULL,
    ethnicity_source_value varchar(50) NULL,
    ethnicity_source_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.observation_period (
    observation_period_id integer NOT NULL,
    person_id integer NOT NULL,
    observation_period_start_date date NOT NULL,
    observation_period_end_date date NOT NULL,
    period_type_concept_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS pancreas.visit_occurrence (
    visit_occurrence_id integer NOT NULL,
    person_id integer NOT NULL,
    visit_concept_id integer NOT NULL,
    visit_start_date date NOT NULL,
    visit_start_datetime TIMESTAMP NULL,
    visit_end_date date NOT NULL,
    visit_end_datetime TIMESTAMP NULL,
    visit_type_concept_id integer NOT NULL,
    provider_id integer NULL,
    care_site_id integer NULL,
    visit_source_value varchar(50) NULL,
    visit_source_concept_id integer NULL,
    admitted_from_concept_id integer NULL,
    admitted_from_source_value varchar(50) NULL,
    discharged_to_concept_id integer NULL,
    discharged_to_source_value varchar(50) NULL,
    preceding_visit_occurrence_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.condition_occurrence (
    condition_occurrence_id integer NOT NULL,
    person_id integer NOT NULL,
    condition_concept_id integer NOT NULL,
    condition_start_date date NOT NULL,
    condition_start_datetime TIMESTAMP NULL,
    condition_end_date date NULL,
    condition_end_datetime TIMESTAMP NULL,
    condition_type_concept_id integer NOT NULL,
    condition_status_concept_id integer NULL,
    stop_reason varchar(20) NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    condition_source_value varchar(50) NULL,
    condition_source_concept_id integer NULL,
    condition_status_source_value varchar(50) NULL
);

CREATE TABLE IF NOT EXISTS pancreas.procedure_occurrence (
    procedure_occurrence_id integer NOT NULL,
    person_id integer NOT NULL,
    procedure_concept_id integer NOT NULL,
    procedure_date date NOT NULL,
    procedure_datetime TIMESTAMP NULL,
    procedure_end_date date NULL,
    procedure_end_datetime TIMESTAMP NULL,
    procedure_type_concept_id integer NOT NULL,
    modifier_concept_id integer NULL,
    quantity integer NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    procedure_source_value varchar(50) NULL,
    procedure_source_concept_id integer NULL,
    modifier_source_value varchar(50) NULL
);

CREATE TABLE IF NOT EXISTS pancreas.measurement (
    measurement_id integer NOT NULL,
    person_id integer NOT NULL,
    measurement_concept_id integer NOT NULL,
    measurement_date date NOT NULL,
    measurement_datetime TIMESTAMP NULL,
    measurement_time varchar(10) NULL,
    measurement_type_concept_id integer NOT NULL,
    operator_concept_id integer NULL,
    value_as_number NUMERIC NULL,
    value_as_concept_id integer NULL,
    unit_concept_id integer NULL,
    range_low NUMERIC NULL,
    range_high NUMERIC NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    measurement_source_value varchar(50) NULL,
    measurement_source_concept_id integer NULL,
    unit_source_value varchar(50) NULL,
    unit_source_concept_id integer NULL,
    value_source_value varchar(50) NULL,
    measurement_event_id bigint NULL,
    meas_event_field_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.observation (
    observation_id integer NOT NULL,
    person_id integer NOT NULL,
    observation_concept_id integer NOT NULL,
    observation_date date NOT NULL,
    observation_datetime TIMESTAMP NULL,
    observation_type_concept_id integer NOT NULL,
    value_as_number NUMERIC NULL,
    value_as_string varchar(60) NULL,
    value_as_concept_id integer NULL,
    qualifier_concept_id integer NULL,
    unit_concept_id integer NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    observation_source_value varchar(50) NULL,
    observation_source_concept_id integer NULL,
    unit_source_value varchar(50) NULL,
    qualifier_source_value varchar(50) NULL,
    value_source_value varchar(50) NULL,
    observation_event_id bigint NULL,
    obs_event_field_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.specimen (
    specimen_id integer NOT NULL,
    person_id integer NOT NULL,
    specimen_concept_id integer NOT NULL,
    specimen_type_concept_id integer NOT NULL,
    specimen_date date NOT NULL,
    specimen_datetime TIMESTAMP NULL,
    quantity NUMERIC NULL,
    unit_concept_id integer NULL,
    anatomic_site_concept_id integer NULL,
    disease_status_concept_id integer NULL,
    specimen_source_id varchar(50) NULL,
    specimen_source_value varchar(50) NULL,
    unit_source_value varchar(50) NULL,
    anatomic_site_source_value varchar(50) NULL,
    disease_status_source_value varchar(50) NULL
);

CREATE TABLE IF NOT EXISTS pancreas.death (
    person_id integer NOT NULL,
    death_date date NOT NULL,
    death_datetime TIMESTAMP NULL,
    death_type_concept_id integer NULL,
    cause_concept_id integer NULL,
    cause_source_value varchar(50) NULL,
    cause_source_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.note (
    note_id integer NOT NULL,
    person_id integer NOT NULL,
    note_date date NOT NULL,
    note_datetime TIMESTAMP NULL,
    note_type_concept_id integer NOT NULL,
    note_class_concept_id integer NOT NULL,
    note_title varchar(250) NULL,
    note_text TEXT NOT NULL,
    encoding_concept_id integer NOT NULL,
    language_concept_id integer NOT NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    note_source_value varchar(50) NULL,
    note_event_id bigint NULL,
    note_event_field_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.fact_relationship (
    domain_concept_id_1 integer NOT NULL,
    fact_id_1 integer NOT NULL,
    domain_concept_id_2 integer NOT NULL,
    fact_id_2 integer NOT NULL,
    relationship_concept_id integer NOT NULL
);

CREATE TABLE IF NOT EXISTS pancreas.location (
    location_id integer NOT NULL,
    address_1 varchar(50) NULL,
    address_2 varchar(50) NULL,
    city varchar(50) NULL,
    state varchar(2) NULL,
    zip varchar(9) NULL,
    county varchar(20) NULL,
    location_source_value varchar(50) NULL,
    country_concept_id integer NULL,
    country_source_value varchar(80) NULL,
    latitude NUMERIC NULL,
    longitude NUMERIC NULL
);

CREATE TABLE IF NOT EXISTS pancreas.care_site (
    care_site_id integer NOT NULL,
    care_site_name varchar(255) NULL,
    place_of_service_concept_id integer NULL,
    location_id integer NULL,
    care_site_source_value varchar(50) NULL,
    place_of_service_source_value varchar(50) NULL
);

CREATE TABLE IF NOT EXISTS pancreas.provider (
    provider_id integer NOT NULL,
    provider_name varchar(255) NULL,
    npi varchar(20) NULL,
    dea varchar(20) NULL,
    specialty_concept_id integer NULL,
    care_site_id integer NULL,
    year_of_birth integer NULL,
    gender_concept_id integer NULL,
    provider_source_value varchar(50) NULL,
    specialty_source_value varchar(50) NULL,
    specialty_source_concept_id integer NULL,
    gender_source_value varchar(50) NULL,
    gender_source_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.drug_exposure (
    drug_exposure_id integer NOT NULL,
    person_id integer NOT NULL,
    drug_concept_id integer NOT NULL,
    drug_exposure_start_date date NOT NULL,
    drug_exposure_start_datetime TIMESTAMP NULL,
    drug_exposure_end_date date NOT NULL,
    drug_exposure_end_datetime TIMESTAMP NULL,
    verbatim_end_date date NULL,
    drug_type_concept_id integer NOT NULL,
    stop_reason varchar(20) NULL,
    refills integer NULL,
    quantity NUMERIC NULL,
    days_supply integer NULL,
    sig TEXT NULL,
    route_concept_id integer NULL,
    lot_number varchar(50) NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    drug_source_value varchar(50) NULL,
    drug_source_concept_id integer NULL,
    route_source_value varchar(50) NULL,
    dose_unit_source_value varchar(50) NULL
);

CREATE TABLE IF NOT EXISTS pancreas.device_exposure (
    device_exposure_id integer NOT NULL,
    person_id integer NOT NULL,
    device_concept_id integer NOT NULL,
    device_exposure_start_date date NOT NULL,
    device_exposure_start_datetime TIMESTAMP NULL,
    device_exposure_end_date date NULL,
    device_exposure_end_datetime TIMESTAMP NULL,
    device_type_concept_id integer NOT NULL,
    unique_device_id varchar(255) NULL,
    production_id varchar(255) NULL,
    quantity integer NULL,
    provider_id integer NULL,
    visit_occurrence_id integer NULL,
    visit_detail_id integer NULL,
    device_source_value varchar(50) NULL,
    device_source_concept_id integer NULL,
    unit_concept_id integer NULL,
    unit_source_value varchar(50) NULL,
    unit_source_concept_id integer NULL
);

-- Era tables
CREATE TABLE IF NOT EXISTS pancreas.condition_era (
    condition_era_id integer NOT NULL,
    person_id integer NOT NULL,
    condition_concept_id integer NOT NULL,
    condition_era_start_date date NOT NULL,
    condition_era_end_date date NOT NULL,
    condition_occurrence_count integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.drug_era (
    drug_era_id integer NOT NULL,
    person_id integer NOT NULL,
    drug_concept_id integer NOT NULL,
    drug_era_start_date date NOT NULL,
    drug_era_end_date date NOT NULL,
    drug_exposure_count integer NULL,
    gap_days integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.payer_plan_period (
    payer_plan_period_id          integer NOT NULL,
    person_id                     integer NOT NULL,
    payer_plan_period_start_date  date NOT NULL,
    payer_plan_period_end_date    date NOT NULL,
    payer_concept_id              integer,
    payer_source_value            varchar(50),
    payer_source_concept_id       integer,
    plan_concept_id               integer,
    plan_source_value             varchar(50),
    plan_source_concept_id        integer,
    sponsor_concept_id            integer,
    sponsor_source_value          varchar(50),
    sponsor_source_concept_id     integer,
    family_source_value           varchar(50),
    stop_reason_concept_id        integer,
    stop_reason_source_value      varchar(50),
    stop_reason_source_concept_id integer
);

-- Cohort tables (in both CDM and results schemas — results is where Patient Profiles reads from)
CREATE TABLE IF NOT EXISTS pancreas.cohort (
    cohort_definition_id integer NOT NULL,
    subject_id integer NOT NULL,
    cohort_start_date date NOT NULL,
    cohort_end_date date NOT NULL
);

CREATE TABLE IF NOT EXISTS pancreas_results.cohort (
    cohort_definition_id bigint,
    subject_id bigint,
    cohort_start_date date,
    cohort_end_date date
);
CREATE INDEX IF NOT EXISTS idx_pr_cohort_def_subject ON pancreas_results.cohort (cohort_definition_id, subject_id);

-- Episode tables (oncology extension)
CREATE TABLE IF NOT EXISTS pancreas.episode (
    episode_id bigint NOT NULL,
    person_id bigint NOT NULL,
    episode_concept_id integer NOT NULL,
    episode_start_date date NOT NULL,
    episode_start_datetime TIMESTAMP NULL,
    episode_end_date date NULL,
    episode_end_datetime TIMESTAMP NULL,
    episode_parent_id bigint NULL,
    episode_number integer NULL,
    episode_object_concept_id integer NOT NULL,
    episode_type_concept_id integer NOT NULL,
    episode_source_value varchar(50) NULL,
    episode_source_concept_id integer NULL
);

CREATE TABLE IF NOT EXISTS pancreas.episode_event (
    episode_id bigint NOT NULL,
    event_id bigint NOT NULL,
    episode_event_field_concept_id integer NOT NULL
);

-- Metadata
CREATE TABLE IF NOT EXISTS pancreas.metadata (
    metadata_id integer NOT NULL,
    metadata_concept_id integer NOT NULL,
    metadata_type_concept_id integer NOT NULL,
    name varchar(250) NOT NULL,
    value_as_string varchar(250) NULL,
    value_as_concept_id integer NULL,
    value_as_number NUMERIC NULL,
    metadata_date date NULL,
    metadata_datetime TIMESTAMP NULL
);

-- ============================================================
-- ACHILLES RESULTS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS pancreas_results.achilles_results (
    analysis_id integer NOT NULL,
    stratum_1 varchar(255) NULL,
    stratum_2 varchar(255) NULL,
    stratum_3 varchar(255) NULL,
    stratum_4 varchar(255) NULL,
    stratum_5 varchar(255) NULL,
    count_value bigint NULL
);

CREATE TABLE IF NOT EXISTS pancreas_results.achilles_results_dist (
    analysis_id integer NOT NULL,
    stratum_1 varchar(255) NULL,
    stratum_2 varchar(255) NULL,
    stratum_3 varchar(255) NULL,
    stratum_4 varchar(255) NULL,
    stratum_5 varchar(255) NULL,
    count_value bigint NULL,
    min_value NUMERIC NULL,
    max_value NUMERIC NULL,
    avg_value NUMERIC NULL,
    stdev_value NUMERIC NULL,
    median_value NUMERIC NULL,
    p10_value NUMERIC NULL,
    p25_value NUMERIC NULL,
    p75_value NUMERIC NULL,
    p90_value NUMERIC NULL
);

CREATE TABLE IF NOT EXISTS pancreas_results.achilles_performance (
    analysis_id         integer NOT NULL,
    elapsed_seconds     double precision
);

CREATE TABLE IF NOT EXISTS pancreas_results.achilles_analysis (
    analysis_id integer NOT NULL,
    analysis_name varchar(255) NULL,
    stratum_1_name varchar(255) NULL,
    stratum_2_name varchar(255) NULL,
    stratum_3_name varchar(255) NULL,
    stratum_4_name varchar(255) NULL,
    stratum_5_name varchar(255) NULL,
    is_default integer NULL,
    category varchar(255) NULL
);

-- ============================================================
-- PRIMARY KEYS
-- ============================================================

ALTER TABLE pancreas.person ADD CONSTRAINT xpk_person PRIMARY KEY (person_id);
ALTER TABLE pancreas.observation_period ADD CONSTRAINT xpk_observation_period PRIMARY KEY (observation_period_id);
ALTER TABLE pancreas.visit_occurrence ADD CONSTRAINT xpk_visit_occurrence PRIMARY KEY (visit_occurrence_id);
ALTER TABLE pancreas.condition_occurrence ADD CONSTRAINT xpk_condition_occurrence PRIMARY KEY (condition_occurrence_id);
ALTER TABLE pancreas.procedure_occurrence ADD CONSTRAINT xpk_procedure_occurrence PRIMARY KEY (procedure_occurrence_id);
ALTER TABLE pancreas.measurement ADD CONSTRAINT xpk_measurement PRIMARY KEY (measurement_id);
ALTER TABLE pancreas.observation ADD CONSTRAINT xpk_observation PRIMARY KEY (observation_id);
ALTER TABLE pancreas.specimen ADD CONSTRAINT xpk_specimen PRIMARY KEY (specimen_id);
ALTER TABLE pancreas.location ADD CONSTRAINT xpk_location PRIMARY KEY (location_id);
ALTER TABLE pancreas.care_site ADD CONSTRAINT xpk_care_site PRIMARY KEY (care_site_id);
ALTER TABLE pancreas.provider ADD CONSTRAINT xpk_provider PRIMARY KEY (provider_id);
ALTER TABLE pancreas.drug_exposure ADD CONSTRAINT xpk_drug_exposure PRIMARY KEY (drug_exposure_id);
ALTER TABLE pancreas.device_exposure ADD CONSTRAINT xpk_device_exposure PRIMARY KEY (device_exposure_id);
ALTER TABLE pancreas.condition_era ADD CONSTRAINT xpk_condition_era PRIMARY KEY (condition_era_id);
ALTER TABLE pancreas.drug_era ADD CONSTRAINT xpk_drug_era PRIMARY KEY (drug_era_id);
ALTER TABLE pancreas.payer_plan_period ADD CONSTRAINT xpk_payer_plan_period PRIMARY KEY (payer_plan_period_id);
ALTER TABLE pancreas.note ADD CONSTRAINT xpk_note PRIMARY KEY (note_id);
ALTER TABLE pancreas.episode ADD CONSTRAINT xpk_episode PRIMARY KEY (episode_id);
ALTER TABLE pancreas.metadata ADD CONSTRAINT xpk_metadata PRIMARY KEY (metadata_id);

-- ============================================================
-- CDM_SOURCE seed
-- ============================================================

INSERT INTO pancreas.cdm_source VALUES (
    'Pancreatic Cancer Multimodal Corpus',
    'PANC',
    'Acumenus Data Sciences',
    'Multimodal pancreatic cancer research dataset comprising CT imaging (PANCREAS-CT, PanTS, MSD-Pancreas), MRI (PANTHER), whole-slide pathology (CPTAC-PDA), and genomics (TCGA-PAAD). Synthetic patients generated from DICOM metadata demographics.',
    'https://wiki.cancerimagingarchive.net',
    'Parthenon ETL - pancreatic corpus ingestion',
    '2026-03-28',
    '2026-03-28',
    'v5.4',
    756265,
    'v5.0 30-AUG-24'
);

-- ============================================================
-- Vocabulary view (concept table lives in vocab schema, not pancreas)
-- Required by Achilles validity-check analyses that JOIN {cdmSchema}.concept
-- ============================================================
CREATE OR REPLACE VIEW pancreas.concept AS SELECT * FROM vocab.concept;
CREATE OR REPLACE VIEW pancreas.concept_ancestor AS SELECT * FROM vocab.concept_ancestor;

COMMIT;
