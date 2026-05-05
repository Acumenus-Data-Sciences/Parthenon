-- Phase 2 Plan 6 Task 8: AE → CONDITION_OCCURRENCE.
-- AEDECOD (MedDRA Preferred Term) → JOIN vocab.concept (vocabulary_id='MedDRA')
-- → JOIN concept_relationship (relationship_id='Maps to') → SNOMED concept_id.
-- type_concept_id = 32856 ('Diagnostic Report') for clinical-trial AE.

INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_end_date,
    condition_type_concept_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    p.person_id,
    COALESCE(c2.concept_id, 0) AS condition_concept_id,
    NULLIF(a.AESTDTC, '')::DATE AS condition_start_date,
    NULLIF(a.AEENDTC, '')::DATE AS condition_end_date,
    32856 AS condition_type_concept_id,
    a.AETERM AS condition_source_value,
    c1.concept_id AS condition_source_concept_id
FROM sdtm_source.fmt_ae a
JOIN ${parameters.cdm_schema}.person p ON p.person_source_value = a.USUBJID
LEFT JOIN ${parameters.vocab_schema}.concept c1
    ON c1.vocabulary_id = 'MedDRA' AND c1.concept_name ILIKE a.AEDECOD
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id AND c2.standard_concept = 'S'
WHERE NULLIF(a.AESTDTC, '') IS NOT NULL;
