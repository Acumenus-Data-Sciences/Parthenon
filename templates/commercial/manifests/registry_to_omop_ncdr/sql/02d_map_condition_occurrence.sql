-- Phase 3 Plan 4C Task 4 (T-022C): NCDR -> CONDITION_OCCURRENCE.
-- Two passes: pre-op diagnosis (single ICD-10) + postop complications
-- (booleans -> SNOMED).

-- Pass 1: pre-op
INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    abs(hashtext(p.patient_id)),
    COALESCE(snomed.concept_id, 0),
    p.procedure_date,  -- pre-op condition; same-day for index PCI
    32865,  -- 'Pre-op condition (registry)'
    p.preop_diagnosis_icd10,
    icd.concept_id
FROM ${parameters.source_schema}.fmt_ncdr_pci p
LEFT JOIN ${parameters.vocab_schema}.concept icd
    ON icd.concept_code = p.preop_diagnosis_icd10 AND icd.vocabulary_id = 'ICD10CM'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = icd.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2 AND snomed.standard_concept = 'S';

-- Pass 2: postop complications (one INSERT per TRUE flag)
INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value
)
SELECT abs(hashtext(p.patient_id)), 432254, p.procedure_date, 32865, 'NCDR:postop_bleeding'
FROM ${parameters.source_schema}.fmt_ncdr_pci p WHERE p.postop_bleeding = TRUE
UNION ALL
SELECT abs(hashtext(p.patient_id)), 4126706, p.procedure_date, 32865, 'NCDR:postop_aki'
FROM ${parameters.source_schema}.fmt_ncdr_pci p WHERE p.postop_aki = TRUE
UNION ALL
SELECT abs(hashtext(p.patient_id)), 4007650, p.procedure_date, 32865, 'NCDR:postop_stroke'
FROM ${parameters.source_schema}.fmt_ncdr_pci p WHERE p.postop_stroke = TRUE;
