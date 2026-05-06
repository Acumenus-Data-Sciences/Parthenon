-- Phase 2 Plan 5 Task 8: bootstrap omop.episode + episode_event for the
-- CDM v5.4 oncology extension. Phase 1 didn't ship these.

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.episode (
    episode_id BIGSERIAL PRIMARY KEY,
    person_id BIGINT NOT NULL,
    episode_concept_id INTEGER NOT NULL,
    episode_start_date DATE NOT NULL,
    episode_end_date DATE,
    episode_parent_id BIGINT,
    episode_number INTEGER,
    episode_object_concept_id INTEGER NOT NULL,
    episode_type_concept_id INTEGER NOT NULL,
    episode_source_value VARCHAR(255),
    episode_source_concept_id INTEGER
);

CREATE TABLE IF NOT EXISTS ${parameters.cdm_schema}.episode_event (
    episode_id BIGINT NOT NULL,
    event_id BIGINT NOT NULL,
    episode_event_field_concept_id INTEGER NOT NULL,
    PRIMARY KEY (episode_id, event_id, episode_event_field_concept_id)
);
