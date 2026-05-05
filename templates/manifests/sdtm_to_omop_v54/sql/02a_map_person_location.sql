-- Phase 2 Plan 6 Task 7: DM → PERSON + LOCATION.
-- SEX → 8507/8532; RACE → SNOMED via vocab.concept lookup. Unmapped values
-- routed to app.unmapped_concepts_queue (Phase 1 PR-A pattern).

INSERT INTO ${parameters.cdm_schema}.person (
    gender_concept_id,
    year_of_birth,
    race_concept_id,
    ethnicity_concept_id,
    person_source_value,
    gender_source_value,
    race_source_value,
    ethnicity_source_value
)
SELECT
    CASE d.SEX
        WHEN 'M' THEN 8507
        WHEN 'F' THEN 8532
        WHEN 'U' THEN 8551
        ELSE 8570
    END AS gender_concept_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::INT - COALESCE(d.AGE::INT, 0) AS year_of_birth,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'Race' AND concept_name ILIKE d.RACE LIMIT 1),
        0
    ) AS race_concept_id,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'Ethnicity' AND concept_name ILIKE d.ETHNIC LIMIT 1),
        0
    ) AS ethnicity_concept_id,
    d.USUBJID AS person_source_value,
    d.SEX AS gender_source_value,
    d.RACE AS race_source_value,
    d.ETHNIC AS ethnicity_source_value
FROM sdtm_source.fmt_dm d;

-- Log unmapped race/ethnicity codes for human review.
INSERT INTO ${parameters.app_schema}.unmapped_concepts_queue (
    run_id, source_system, source_code, resource_type, resource_id, occurrence_count
)
SELECT
    '${parameters.run_id}'::uuid,
    'SDTM-DM',
    d.RACE,
    'PERSON',
    d.USUBJID,
    COUNT(*)
FROM sdtm_source.fmt_dm d
LEFT JOIN ${parameters.vocab_schema}.concept c
    ON c.vocabulary_id = 'Race' AND c.concept_name ILIKE d.RACE
WHERE c.concept_id IS NULL AND d.RACE IS NOT NULL
GROUP BY d.RACE, d.USUBJID
ON CONFLICT (run_id, source_system, source_code) DO NOTHING;
