-- Phase 3 Plan 4A Task 4 (T-022A): NAACCR -> CONDITION_OCCURRENCE.
--
-- Ported from OHDSI/CdmEtlNaaccr (Apache-2.0, see ohdsi_pin.txt) and
-- re-targeted for PostgreSQL. Per-tumor mapping rules:
--
-- 1. ICD-O-3 topography (primary_site, e.g. C509) is the primary
--    mapping axis. We join against the OMOP Vocabulary's ICDO3 entries
--    to find the source concept_id.
-- 2. The standard concept_id for CONDITION_OCCURRENCE is the SNOMED
--    target reached via concept_relationship 'Maps to'. ICD-O-3 maps
--    cleanly to SNOMED for ~95% of malignant primaries; unmapped
--    topographies fall back to concept_id=0.
-- 3. condition_type_concept_id = 32864 ('Tumor registry detail'),
--    the OMOP-blessed type for NAACCR-sourced conditions per the
--    Oncology subgroup convention.
-- 4. Behavior 3 (malignant primary) and 6 (malignant metastatic) flow
--    into CONDITION_OCCURRENCE; benign / in-situ / uncertain rows
--    project to the OBSERVATION table — not in v0.1 scope.

INSERT INTO ${parameters.cdm_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    condition_source_value,
    condition_source_concept_id
)
SELECT
    -- Person identity is per-patient_id_number; v0.1 hashes the source
    -- string deterministically (matches the NCPDP convention; proper MPI
    -- integration is Phase 4 follow-up).
    abs(hashtext(r.patient_id_number)) AS person_id,
    COALESCE(snomed.concept_id, 0) AS condition_concept_id,
    r.date_of_diagnosis AS condition_start_date,
    32864 AS condition_type_concept_id,
    r.primary_site AS condition_source_value,
    icdo3.concept_id AS condition_source_concept_id
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
