-- Phase 3 Plan 1 Task 9: 837 → CONDITION_OCCURRENCE.
--
-- The 837's diagnosis codes live in fmt_837_claim.diagnosis_codes (a
-- TEXT[] populated from HI*ABK / ABF / BK / BF segments). We unnest the
-- array, join vocab.concept (vocabulary_id='ICD10CM') and traverse
-- concept_relationship 'Maps to' to land on a standard SNOMED concept.
--
-- condition_type_concept_id = 32840 ('Condition recorded as billing
-- claim diagnosis').
--
-- The first diagnosis on a 837 claim is the principal (HI*ABK in 837P/I,
-- HI*BK in pre-5010 form); subsequent are secondary (ABF/BF). We use
-- ordinality to flag the primary condition via condition_status_concept_id
-- = 32902 ('Primary'). Secondaries get 0 (no status known).

INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    condition_occurrence_id,
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_end_date,
    condition_type_concept_id,
    condition_status_concept_id,
    visit_occurrence_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    -- Synthesize a stable ID from (visit_occurrence_id, ordinality).
    -- BIGINT*1000 gives 999 diagnoses per claim — well above any realistic
    -- 837 limit (12 ICD-10 codes per HI segment, max ~12 HI segments).
    v.visit_occurrence_id * 1000 + dx.ordinality AS condition_occurrence_id,
    v.person_id,
    COALESCE(std.concept_id, 0) AS condition_concept_id,
    c.statement_date AS condition_start_date,
    c.statement_date AS condition_end_date,
    32840 AS condition_type_concept_id,
    CASE WHEN dx.ordinality = 1 THEN 32902 ELSE 0 END AS condition_status_concept_id,
    v.visit_occurrence_id,
    dx.code AS condition_source_value,
    src.concept_id AS condition_source_concept_id
FROM ${parameters.source_schema}.fmt_837_claim c
JOIN ${parameters.cdm_schema}.visit_occurrence v ON v.visit_occurrence_id = c.id
CROSS JOIN LATERAL UNNEST(c.diagnosis_codes) WITH ORDINALITY AS dx(code, ordinality)
LEFT JOIN ${parameters.vocab_schema}.concept src
    ON src.vocabulary_id = 'ICD10CM'
    AND src.concept_code = dx.code
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = src.concept_id
    AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept std
    ON std.concept_id = cr.concept_id_2
    AND std.standard_concept = 'S'
ON CONFLICT (condition_occurrence_id) DO NOTHING;
