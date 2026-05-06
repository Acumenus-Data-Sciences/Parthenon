-- Phase 2 Plan 4 Task 13: NOTE mapper (Stage 7 — noteevents).
-- Each noteevents row → omop.note. note_class_concept_id from category;
-- note_text retained for downstream parthenon_ner_llm consumption.

INSERT INTO ${parameters.target_schema}.note (
    person_id,
    note_event_id,
    note_event_field_concept_id,
    note_date,
    note_datetime,
    note_type_concept_id,
    note_class_concept_id,
    note_title,
    note_text,
    encoding_concept_id,
    language_concept_id,
    visit_occurrence_id,
    note_source_value
)
SELECT
    n.subject_id,
    n.id AS note_event_id,
    1147127 AS note_event_field_concept_id,  -- generic note event field
    COALESCE(n.chartdate, DATE(n.charttime)),
    n.charttime,
    32817 AS note_type_concept_id,  -- 'EHR'
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'LOINC' AND concept_class_id = 'Doc Kind'
           AND concept_name ILIKE n.category LIMIT 1),
        706617  -- 'Other generic clinical document'
    ) AS note_class_concept_id,
    n.description AS note_title,
    n.text AS note_text,
    32678 AS encoding_concept_id,  -- UTF-8
    4180186 AS language_concept_id,  -- English
    n.hadm_id,
    n.category
FROM mimic_iv_source.fmt_noteevents n
WHERE COALESCE(n.iserror, 0) = 0;
