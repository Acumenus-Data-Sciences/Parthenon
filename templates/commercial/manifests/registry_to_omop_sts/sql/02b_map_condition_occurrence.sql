-- Phase 3 Plan 4B Task 4 (T-022B): STS -> CONDITION_OCCURRENCE.
-- Two passes: pre-op diagnoses (primary + secondary ICD-10-CM) and
-- postop complications (booleans -> SNOMED concepts).

-- Pass 1: pre-op primary diagnosis
INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    abs(hashtext(s.patient_id)) AS person_id,
    COALESCE(snomed.concept_id, 0) AS condition_concept_id,
    s.surgery_date - INTERVAL '1 day' AS condition_start_date,
    32865 AS condition_type_concept_id,  -- 'Pre-op condition (registry)'
    s.primary_diagnosis_icd10 AS condition_source_value,
    icd.concept_id AS condition_source_concept_id
FROM ${parameters.source_schema}.fmt_sts_surgery s
LEFT JOIN ${parameters.vocab_schema}.concept icd
    ON icd.concept_code = s.primary_diagnosis_icd10 AND icd.vocabulary_id = 'ICD10CM'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = icd.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2 AND snomed.standard_concept = 'S';

-- Pass 2: secondary diagnoses
INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    abs(hashtext(s.patient_id)) AS person_id,
    COALESCE(snomed.concept_id, 0) AS condition_concept_id,
    s.surgery_date - INTERVAL '1 day' AS condition_start_date,
    32865 AS condition_type_concept_id,
    sec_dx AS condition_source_value,
    icd.concept_id AS condition_source_concept_id
FROM ${parameters.source_schema}.fmt_sts_surgery s
CROSS JOIN LATERAL unnest(COALESCE(s.secondary_diagnoses_icd10, ARRAY[]::TEXT[])) AS sec_dx
LEFT JOIN ${parameters.vocab_schema}.concept icd
    ON icd.concept_code = sec_dx AND icd.vocabulary_id = 'ICD10CM'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = icd.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2 AND snomed.standard_concept = 'S';

-- Pass 3: postop complications (one row per TRUE flag).
-- We use SNOMED hard-coded standard concepts because postop complication
-- categories don't have ICD-10-CM source codes in the STS export — the
-- STS Definition encodes them as booleans.

INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value
)
SELECT abs(hashtext(s.patient_id)), 4126706, s.surgery_date, 32865, 'STS:postop_aki'
FROM ${parameters.source_schema}.fmt_sts_surgery s WHERE s.postop_aki = TRUE
UNION ALL
SELECT abs(hashtext(s.patient_id)), 4007650, s.surgery_date, 32865, 'STS:postop_stroke'
FROM ${parameters.source_schema}.fmt_sts_surgery s WHERE s.postop_stroke = TRUE
UNION ALL
SELECT abs(hashtext(s.patient_id)), 4131606, s.surgery_date, 32865, 'STS:postop_reoperation'
FROM ${parameters.source_schema}.fmt_sts_surgery s WHERE s.postop_reoperation = TRUE
UNION ALL
SELECT abs(hashtext(s.patient_id)), 132797, s.surgery_date, 32865, 'STS:postop_sepsis'
FROM ${parameters.source_schema}.fmt_sts_surgery s WHERE s.postop_sepsis = TRUE;
