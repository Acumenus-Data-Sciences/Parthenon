-- OMOP CDM v5.4 — Phase 0 minimal subset.
-- The bootstrap runner SETs search_path before executing; statements are
-- unqualified.

CREATE TABLE IF NOT EXISTS person (
    person_id                       BIGINT PRIMARY KEY,
    gender_concept_id               BIGINT NOT NULL,
    year_of_birth                   INTEGER NOT NULL,
    month_of_birth                  INTEGER,
    day_of_birth                    INTEGER,
    birth_datetime                  TIMESTAMP,
    race_concept_id                 BIGINT NOT NULL,
    ethnicity_concept_id            BIGINT NOT NULL,
    location_id                     BIGINT,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    person_source_value             VARCHAR(50),
    gender_source_value             VARCHAR(50),
    gender_source_concept_id        BIGINT,
    race_source_value               VARCHAR(50),
    race_source_concept_id          BIGINT,
    ethnicity_source_value          VARCHAR(50),
    ethnicity_source_concept_id     BIGINT
);

CREATE TABLE IF NOT EXISTS visit_occurrence (
    visit_occurrence_id             BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    visit_concept_id                BIGINT NOT NULL,
    visit_start_date                DATE NOT NULL,
    visit_start_datetime            TIMESTAMP,
    visit_end_date                  DATE NOT NULL,
    visit_end_datetime              TIMESTAMP,
    visit_type_concept_id           BIGINT NOT NULL,
    provider_id                     BIGINT,
    care_site_id                    BIGINT,
    visit_source_value              VARCHAR(50),
    visit_source_concept_id         BIGINT,
    admitted_from_concept_id        BIGINT,
    admitted_from_source_value      VARCHAR(50),
    discharged_to_concept_id        BIGINT,
    discharged_to_source_value      VARCHAR(50),
    preceding_visit_occurrence_id   BIGINT
);

CREATE TABLE IF NOT EXISTS drug_exposure (
    drug_exposure_id                BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    drug_concept_id                 BIGINT NOT NULL,
    drug_exposure_start_date        DATE NOT NULL,
    drug_exposure_start_datetime    TIMESTAMP,
    drug_exposure_end_date          DATE NOT NULL,
    drug_exposure_end_datetime      TIMESTAMP,
    verbatim_end_date               DATE,
    drug_type_concept_id            BIGINT NOT NULL,
    stop_reason                     VARCHAR(20),
    refills                         INTEGER,
    quantity                        NUMERIC,
    days_supply                     INTEGER,
    sig                             TEXT,
    route_concept_id                BIGINT,
    lot_number                      VARCHAR(50),
    provider_id                     BIGINT,
    visit_occurrence_id             BIGINT,
    visit_detail_id                 BIGINT,
    drug_source_value               VARCHAR(50),
    drug_source_concept_id          BIGINT,
    route_source_value              VARCHAR(50),
    dose_unit_source_value          VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS concept (
    concept_id                      BIGINT PRIMARY KEY,
    concept_name                    VARCHAR(255) NOT NULL,
    domain_id                       VARCHAR(20) NOT NULL,
    vocabulary_id                   VARCHAR(20) NOT NULL,
    concept_class_id                VARCHAR(20) NOT NULL,
    standard_concept                VARCHAR(1),
    concept_code                    VARCHAR(50) NOT NULL,
    valid_start_date                DATE NOT NULL,
    valid_end_date                  DATE NOT NULL,
    invalid_reason                  VARCHAR(1)
);
