-- Phase 3 Plan 4C Task 4 (T-022C): NCDR -> PROCEDURE_OCCURRENCE.
-- One row per primary procedure. NCDR doesn't carry secondary CPT codes
-- separately (lesion-level granularity is captured in lesion_segments
-- and stent-level granularity in stent_udis); the primary CPT covers
-- the index PCI.

INSERT INTO ${parameters.cdm_schema}.procedure_occurrence (
    person_id,
    procedure_concept_id,
    procedure_date,
    procedure_type_concept_id,
    procedure_source_value,
    procedure_source_concept_id
)
SELECT
    abs(hashtext(p.patient_id)) AS person_id,
    COALESCE(snomed.concept_id, 0) AS procedure_concept_id,
    p.procedure_date AS procedure_date,
    32861 AS procedure_type_concept_id,  -- 'Registry-derived procedure'
    p.primary_procedure_code AS procedure_source_value,
    cpt.concept_id AS procedure_source_concept_id
FROM ${parameters.source_schema}.fmt_ncdr_pci p
LEFT JOIN ${parameters.vocab_schema}.concept cpt
    ON cpt.concept_code = p.primary_procedure_code
       AND cpt.vocabulary_id IN ('CPT4', 'HCPCS')
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = cpt.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2 AND snomed.standard_concept = 'S';
