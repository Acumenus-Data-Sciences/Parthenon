-- OMOP Oncology Extension — Phase 0 minimal subset.
-- Loaded AFTER the v5.4 base SQL because Episode references CDM tables.
--
-- The ``\i v5_4.sql`` directive below is a psql-only convenience for ad-hoc
-- usage; the Python loader (``runtime.cdm.bootstrap``) strips it and runs the
-- v5.4 DDL programmatically before applying the oncology-specific DDL.

\i v5_4.sql

CREATE TABLE IF NOT EXISTS episode (
    episode_id                      BIGINT PRIMARY KEY,
    person_id                       BIGINT NOT NULL,
    episode_concept_id              BIGINT NOT NULL,
    episode_start_date              DATE NOT NULL,
    episode_start_datetime          TIMESTAMP,
    episode_end_date                DATE,
    episode_end_datetime            TIMESTAMP,
    episode_parent_id               BIGINT,
    episode_number                  INTEGER,
    episode_object_concept_id       BIGINT NOT NULL,
    episode_type_concept_id         BIGINT NOT NULL,
    episode_source_value            VARCHAR(50),
    episode_source_concept_id       BIGINT
);

CREATE TABLE IF NOT EXISTS episode_event (
    episode_id                      BIGINT NOT NULL REFERENCES episode (episode_id),
    event_id                        BIGINT NOT NULL,
    episode_event_field_concept_id  BIGINT NOT NULL
);
