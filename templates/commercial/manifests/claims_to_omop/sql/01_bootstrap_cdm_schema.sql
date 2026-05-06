-- Phase 3 Plan 1 Task 8: minimum-shape OMOP CDM v5.4 target tables for
-- claims_to_omop. We don't ship the full CDM here — the upstream
-- ``parthenon-templates-omop-bootstrap`` template does that. This file
-- creates ONLY the four tables claims_to_omop writes into, plus the
-- payer_plan_period stub the COST table FK-references.
--
-- Customers running the full CDM will already have these tables; the
-- IF NOT EXISTS guards keep this idempotent.

CREATE SCHEMA IF NOT EXISTS ${parameters.cdm_schema};

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.payer_plan_period (
    payer_plan_period_id BIGINT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    payer_plan_period_start_date DATE NOT NULL,
    payer_plan_period_end_date DATE NOT NULL,
    payer_concept_id INTEGER,
    payer_source_value VARCHAR(80),
    plan_concept_id INTEGER,
    plan_source_value VARCHAR(80),
    contract_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.visit_occurrence (
    visit_occurrence_id BIGINT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    visit_concept_id INTEGER NOT NULL,
    visit_start_date DATE NOT NULL,
    visit_start_datetime TIMESTAMP,
    visit_end_date DATE NOT NULL,
    visit_end_datetime TIMESTAMP,
    visit_type_concept_id INTEGER NOT NULL,
    provider_id BIGINT,
    care_site_id BIGINT,
    visit_source_value VARCHAR(80),
    visit_source_concept_id INTEGER,
    admitted_from_concept_id INTEGER,
    admitted_from_source_value VARCHAR(80),
    discharged_to_concept_id INTEGER,
    discharged_to_source_value VARCHAR(80),
    preceding_visit_occurrence_id BIGINT
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.procedure_occurrence (
    procedure_occurrence_id BIGINT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    procedure_concept_id INTEGER NOT NULL,
    procedure_date DATE NOT NULL,
    procedure_datetime TIMESTAMP,
    procedure_end_date DATE,
    procedure_end_datetime TIMESTAMP,
    procedure_type_concept_id INTEGER NOT NULL,
    modifier_concept_id INTEGER,
    quantity INTEGER,
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    procedure_source_value VARCHAR(80),
    procedure_source_concept_id INTEGER,
    modifier_source_value VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.condition_occurrence (
    condition_occurrence_id BIGINT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    condition_concept_id INTEGER NOT NULL,
    condition_start_date DATE NOT NULL,
    condition_start_datetime TIMESTAMP,
    condition_end_date DATE,
    condition_end_datetime TIMESTAMP,
    condition_type_concept_id INTEGER NOT NULL,
    condition_status_concept_id INTEGER,
    stop_reason VARCHAR(20),
    provider_id BIGINT,
    visit_occurrence_id BIGINT,
    visit_detail_id BIGINT,
    condition_source_value VARCHAR(80),
    condition_source_concept_id INTEGER,
    condition_status_source_value VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.cost (
    cost_id BIGSERIAL PRIMARY KEY,
    cost_event_id BIGINT NOT NULL,
    cost_event_field_concept_id INTEGER NOT NULL,
    cost_concept_id INTEGER NOT NULL,
    cost_type_concept_id INTEGER,
    currency_concept_id INTEGER NOT NULL,
    cost NUMERIC(14, 2) NOT NULL,
    incurred_date DATE,
    billed_date DATE,
    paid_date DATE,
    revenue_code_concept_id INTEGER,
    drg_concept_id INTEGER,
    cost_source_value VARCHAR(80),
    cost_source_concept_id INTEGER,
    revenue_code_source_value VARCHAR(80),
    drg_source_value VARCHAR(80),
    payer_plan_period_id BIGINT
);

CREATE INDEX IF NOT EXISTS ix_visit_occurrence_person
    ON ${parameters.cdm_schema}.visit_occurrence (person_id);

CREATE INDEX IF NOT EXISTS ix_procedure_occurrence_visit
    ON ${parameters.cdm_schema}.procedure_occurrence (visit_occurrence_id);

CREATE INDEX IF NOT EXISTS ix_cost_event
    ON ${parameters.cdm_schema}.cost (cost_event_field_concept_id, cost_event_id);
