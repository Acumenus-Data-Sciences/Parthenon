-- Phase 3 Plan 5 Task 5 (T-023): lis_lab_to_omop source schema bootstrap.
--
-- ``fmt_oru_message`` holds one row per HL7 v2 ORU message (R01/R30/R31);
-- ``fmt_oru_observation`` holds one row per OBX segment within a message.
-- The Hl7v2OruReader (community-tier) materializes these from the wire
-- format; the MEASUREMENT mapper (Task 6) projects fmt_oru_observation
-- rows into ``${parameters.cdm_schema}.measurement`` and Task 7 queues
-- unmapped local codes for the T-024 commercial harmonizer.
--
-- HIGHSEC §7: patient_id is stored as the raw PID-3 token here because
-- this template's contract is to preserve the source identifier so
-- downstream OMOP person mapping can join. It is NEVER surfaced in
-- error messages or logs (the reader's _RedactingFilter handles that).

CREATE SCHEMA IF NOT EXISTS ${parameters.source_schema};

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_oru_message (
    message_control_id    TEXT        PRIMARY KEY,
    sending_application   TEXT        NOT NULL,
    sending_facility      TEXT        NOT NULL,
    patient_id            TEXT        NOT NULL,
    encounter_id          TEXT,
    order_control_code    TEXT        NOT NULL,
    universal_service_id  TEXT        NOT NULL,
    received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fmt_oru_message_patient_idx
    ON ${parameters.source_schema}.fmt_oru_message (patient_id);

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.fmt_oru_observation (
    obs_id              BIGSERIAL   PRIMARY KEY,
    message_control_id  TEXT        NOT NULL
        REFERENCES ${parameters.source_schema}.fmt_oru_message (message_control_id)
        ON DELETE CASCADE,
    set_id              INT         NOT NULL CHECK (set_id >= 1),
    value_type          TEXT        NOT NULL,
    observation_id      TEXT        NOT NULL,
    observation_id_text TEXT        NOT NULL,
    coding_system       TEXT        NOT NULL,
    observation_value   TEXT        NOT NULL,
    units               TEXT,
    observation_date    TIMESTAMPTZ NOT NULL,
    abnormal_flag       TEXT,
    UNIQUE (message_control_id, set_id)
);

CREATE INDEX IF NOT EXISTS fmt_oru_observation_local_code_idx
    ON ${parameters.source_schema}.fmt_oru_observation
    (coding_system, observation_id);

CREATE INDEX IF NOT EXISTS fmt_oru_observation_message_idx
    ON ${parameters.source_schema}.fmt_oru_observation (message_control_id);
