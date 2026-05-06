-- Phase 3 Plan 4B Task 4 (T-022B): STS -> EPISODE (one per surgery).
-- Each surgery is a Disease First Occurrence-style episode with the
-- procedure as the anchor. Episode end = discharge date approximated
-- as surgery_date + length_of_stay.

INSERT INTO ${parameters.cdm_schema}.episode (
    person_id,
    episode_concept_id,
    episode_start_date,
    episode_end_date,
    episode_type_concept_id,
    episode_source_value
)
SELECT
    abs(hashtext(s.patient_id)) AS person_id,
    32873 AS episode_concept_id,  -- 'Procedure-Anchored Episode' (Oncology Extension semantics)
    s.surgery_date AS episode_start_date,
    s.surgery_date + (s.length_of_stay || ' days')::INTERVAL AS episode_end_date,
    32861 AS episode_type_concept_id,  -- 'Registry-derived'
    -- Canonical assembly: procedure category + primary CPT code (no PHI).
    (s.procedure_category || ':' || s.primary_procedure_code) AS episode_source_value
FROM ${parameters.source_schema}.fmt_sts_surgery s;
