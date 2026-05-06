-- Phase 3 Plan 4B Task 4 (T-022B): STS -> PROCEDURE_OCCURRENCE.
-- One row per primary procedure (CPT/HCPCS) per surgery. Secondary
-- procedure codes also fan out as separate procedure_occurrence rows
-- via the LATERAL unnest, sharing the same surgery_date but carrying
-- their own concept_id.

INSERT INTO ${parameters.cdm_schema}.procedure_occurrence (
    person_id,
    procedure_concept_id,
    procedure_date,
    procedure_type_concept_id,
    procedure_source_value,
    procedure_source_concept_id
)
-- Primary procedure
SELECT
    abs(hashtext(s.patient_id)) AS person_id,
    COALESCE(snomed.concept_id, 0) AS procedure_concept_id,
    s.surgery_date AS procedure_date,
    32861 AS procedure_type_concept_id,  -- 'Registry-derived procedure'
    s.primary_procedure_code AS procedure_source_value,
    cpt.concept_id AS procedure_source_concept_id
FROM ${parameters.source_schema}.fmt_sts_surgery s
LEFT JOIN ${parameters.vocab_schema}.concept cpt
    ON cpt.concept_code = s.primary_procedure_code
       AND cpt.vocabulary_id IN ('CPT4', 'HCPCS')
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = cpt.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2 AND snomed.standard_concept = 'S'

UNION ALL

-- Secondary procedures (one row per code in the array)
SELECT
    abs(hashtext(s.patient_id)) AS person_id,
    COALESCE(snomed2.concept_id, 0) AS procedure_concept_id,
    s.surgery_date AS procedure_date,
    32861 AS procedure_type_concept_id,
    sec_code AS procedure_source_value,
    cpt2.concept_id AS procedure_source_concept_id
FROM ${parameters.source_schema}.fmt_sts_surgery s
CROSS JOIN LATERAL unnest(COALESCE(s.secondary_procedure_codes, ARRAY[]::TEXT[])) AS sec_code
LEFT JOIN ${parameters.vocab_schema}.concept cpt2
    ON cpt2.concept_code = sec_code
       AND cpt2.vocabulary_id IN ('CPT4', 'HCPCS')
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr2
    ON cr2.concept_id_1 = cpt2.concept_id AND cr2.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed2
    ON snomed2.concept_id = cr2.concept_id_2 AND snomed2.standard_concept = 'S';
