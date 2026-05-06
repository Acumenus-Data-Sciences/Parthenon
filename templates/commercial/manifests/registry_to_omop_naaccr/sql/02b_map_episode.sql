-- Phase 3 Plan 4A Task 4 (T-022A): NAACCR -> EPISODE (Oncology Extension).
--
-- Ported from OHDSI/CdmEtlNaaccr (Apache-2.0). Each tumor record
-- produces one EPISODE row of type "Disease First Occurrence" — the
-- cancer diagnosis itself. EPISODE_EVENT (02c) links the treatments
-- back to this episode via episode_parent_id.
--
-- EPISODE convention (OMOP CDM v5.4 §EPISODE + Oncology Extension):
--
-- - episode_concept_id = 32528 (Disease First Occurrence)
-- - episode_object_concept_id = SNOMED concept reached from ICD-O-3
--   (same as condition_concept_id)
-- - episode_type_concept_id = 32864 (Tumor registry detail)
-- - episode_source_value = primary_site || histologic_type_icdo3
--   so the canonical name carries downstream
-- - HIGHSEC §7: episode_source_value MUST be assembled from canonical
--   ICD-O-3 codes only — never from patient_id_number, name, etc.

INSERT INTO ${parameters.cdm_schema}.episode (
    person_id,
    episode_concept_id,
    episode_start_date,
    episode_end_date,
    episode_object_concept_id,
    episode_type_concept_id,
    episode_source_value
)
SELECT
    abs(hashtext(r.patient_id_number)) AS person_id,
    32528 AS episode_concept_id,
    r.date_of_diagnosis AS episode_start_date,
    -- For v0.1, end_date = date_of_last_contact when known, else null.
    -- The Oncology Extension expects null for ongoing episodes.
    r.date_of_last_contact AS episode_end_date,
    COALESCE(snomed.concept_id, 0) AS episode_object_concept_id,
    32864 AS episode_type_concept_id,
    -- Canonical assembly: site||histology, both ICD-O-3.
    (r.primary_site || '/' || r.histologic_type_icdo3) AS episode_source_value
FROM ${parameters.source_schema}.fmt_naaccr_record r
LEFT JOIN ${parameters.vocab_schema}.concept icdo3
    ON icdo3.concept_code = r.primary_site
       AND icdo3.vocabulary_id = 'ICDO3'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = icdo3.concept_id
       AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept snomed
    ON snomed.concept_id = cr.concept_id_2
       AND snomed.standard_concept = 'S'
WHERE r.behavior_code_icdo3 IN ('3', '6');
