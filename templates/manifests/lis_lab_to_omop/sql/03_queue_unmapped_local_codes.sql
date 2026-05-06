-- Phase 3 Plan 5 Task 7 (T-023): unmapped_local_lab_code queue.
--
-- Per-row contract: every fmt_oru_observation whose coding_system is
-- non-LOINC (i.e. 'L' / facility-local / blank) — OR whose LOINC code
-- did not resolve to a standard concept — is appended to a per-template
-- queue table with usage statistics. The T-024 commercial AI mapping
-- backend (Plan 6) reads from this queue to suggest LOINC harmonizations.
--
-- BEST-EFFORT DECISION (Task 7, recorded for ADR 0018):
--   The plan referenced ``${app_schema}.unmapped_local_lab_code``, but
--   ``app.*`` is owned by Laravel migrations + Spatie RBAC; templates
--   SQL stages should not reach across that boundary. Instead, the
--   queue lives in ``${source_schema}.unmapped_local_lab_code`` (the
--   same schema the bootstrap created in Task 5). Plan 6 reads from
--   ``${source_schema}.unmapped_local_lab_code`` directly. If the
--   customer needs it surfaced in the Laravel UI, the T-024 commercial
--   stack views/exposes it through its own controller — not by mutating
--   ``app.*`` from a community-tier SQL stage.

CREATE TABLE IF NOT EXISTS ${parameters.source_schema}.unmapped_local_lab_code (
    queue_id            BIGSERIAL   PRIMARY KEY,
    local_code          TEXT        NOT NULL,
    local_code_text     TEXT        NOT NULL,
    coding_system       TEXT        NOT NULL,
    sending_facility    TEXT        NOT NULL,
    observation_count   BIGINT      NOT NULL,
    first_seen_at       TIMESTAMPTZ NOT NULL,
    last_seen_at        TIMESTAMPTZ NOT NULL,
    UNIQUE (local_code, coding_system, sending_facility)
);

-- Aggregate the unmapped-or-non-LOINC observations into the queue.
-- Idempotent: ON CONFLICT updates the rolling counts + last_seen_at.
INSERT INTO ${parameters.source_schema}.unmapped_local_lab_code (
    local_code,
    local_code_text,
    coding_system,
    sending_facility,
    observation_count,
    first_seen_at,
    last_seen_at
)
SELECT
    o.observation_id                            AS local_code,
    -- Pick a representative human-readable label; MIN is deterministic
    -- across replays and avoids a multi-value GROUP BY surprise.
    MIN(o.observation_id_text)                  AS local_code_text,
    COALESCE(NULLIF(o.coding_system, ''), 'L')  AS coding_system,
    m.sending_facility                          AS sending_facility,
    COUNT(*)                                    AS observation_count,
    MIN(o.observation_date)                     AS first_seen_at,
    MAX(o.observation_date)                     AS last_seen_at
FROM ${parameters.source_schema}.fmt_oru_observation o
JOIN ${parameters.source_schema}.fmt_oru_message m
    ON m.message_control_id = o.message_control_id
LEFT JOIN ${parameters.vocab_schema}.concept c_src
    ON  c_src.concept_code = o.observation_id
    AND c_src.vocabulary_id = 'LOINC'
    AND o.coding_system IN ('LN', 'LOINC')
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON  cr.concept_id_1 = c_src.concept_id
    AND cr.relationship_id = 'Maps to'
    AND cr.invalid_reason IS NULL
LEFT JOIN ${parameters.vocab_schema}.concept c_std
    ON  c_std.concept_id = cr.concept_id_2
    AND c_std.standard_concept = 'S'
WHERE c_std.concept_id IS NULL
GROUP BY o.observation_id, COALESCE(NULLIF(o.coding_system, ''), 'L'), m.sending_facility
ON CONFLICT (local_code, coding_system, sending_facility) DO UPDATE
SET observation_count = ${parameters.source_schema}.unmapped_local_lab_code.observation_count
                      + EXCLUDED.observation_count,
    last_seen_at      = GREATEST(
        ${parameters.source_schema}.unmapped_local_lab_code.last_seen_at,
        EXCLUDED.last_seen_at
    );
