-- Phase 3 Plan 5 Task 6 (T-023): OBX -> OMOP MEASUREMENT mapper.
--
-- For each fmt_oru_observation row:
--   * coding_system = 'LN' (or 'LOINC')  -> join vocab.concept on
--     concept_code where vocabulary_id='LOINC' and resolve to a standard
--     concept via concept_relationship 'Maps to'. Unresolved LOINC source
--     codes fall through to measurement_concept_id = 0 (preserved in
--     measurement_source_value).
--   * Any other coding_system (typically 'L' for local lab codes) -> emit
--     measurement_concept_id = 0; the Task 7 queue stage captures these
--     for the T-024 commercial harmonizer.
--
-- BEST-EFFORT DECISION (Task 6, recorded for ADR 0018):
--   Option (1c) — defer the local-code alias-map design to Plan 6. Local
--   codes ride through with concept_id=0 + queue capture; Task 6 does NOT
--   write to a curated app.lab_local_alias table because that table
--   doesn't exist yet and adding it now would conflate Plan 5's
--   community-tier ETL with the Plan 6 commercial-tier mapping work.
--
-- Person mapping: ``person_id`` is derived as
-- ``abs(hashtext(patient_id))::BIGINT`` (same stub pattern as Plan 4A/B/C
-- registries) — replaced by a real source_to_person mapping when the
-- customer wires their identity layer.
--
-- measurement_type_concept_id = 32856 (OMOP standard "Lab result").

INSERT INTO ${parameters.cdm_schema}.measurement (
    person_id,
    measurement_concept_id,
    measurement_date,
    measurement_datetime,
    measurement_type_concept_id,
    value_as_number,
    unit_source_value,
    measurement_source_value,
    measurement_source_concept_id,
    value_source_value,
    visit_occurrence_id
)
SELECT
    abs(hashtext(m.patient_id))::BIGINT                  AS person_id,
    COALESCE(c_std.concept_id, 0)                        AS measurement_concept_id,
    o.observation_date::DATE                             AS measurement_date,
    o.observation_date                                   AS measurement_datetime,
    32856                                                AS measurement_type_concept_id,
    CASE
        WHEN o.value_type = 'NM'
            AND o.observation_value ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN o.observation_value::NUMERIC
    END                                                  AS value_as_number,
    o.units                                              AS unit_source_value,
    o.observation_id                                     AS measurement_source_value,
    COALESCE(c_src.concept_id, 0)                        AS measurement_source_concept_id,
    o.observation_value                                  AS value_source_value,
    NULL::BIGINT                                         AS visit_occurrence_id
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
WHERE NOT EXISTS (
    SELECT 1
    FROM ${parameters.cdm_schema}.measurement existing
    WHERE existing.measurement_source_value = o.observation_id
      AND existing.measurement_datetime    = o.observation_date
      AND existing.person_id               = abs(hashtext(m.patient_id))::BIGINT
);
