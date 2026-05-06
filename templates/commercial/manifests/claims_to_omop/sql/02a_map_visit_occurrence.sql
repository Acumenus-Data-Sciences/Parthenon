-- Phase 3 Plan 1 Task 9: 837 → VISIT_OCCURRENCE.
--
-- Each fmt_837_claim row projects to one visit_occurrence row. The
-- visit_concept_id is derived from CLM05-1 (place_of_service for 837P,
-- facility-type code for 837I/D); we map via vocab.concept on
-- vocabulary_id='CMS Place of Service' and concept_relationship 'Maps to'
-- to land on a standard SNOMED visit concept.
--
-- visit_type_concept_id = 32035 ('Visit derived from claim' — OHDSI
-- claim-derived visit, standardized in OMOP vocab).
--
-- person_id is resolved by hashing (subscriber_id, patient_id) — the
-- claims_to_omop pipeline assumes the upstream member-eligibility
-- ingestion has already populated PERSON. If no person row matches,
-- visit_occurrence_id is allocated but person_id is set to 0 (the
-- OMOP "unknown person" sentinel) so the downstream mappers can still
-- produce procedure/condition rows for orphaned claims.

INSERT INTO ${parameters.cdm_schema}.visit_occurrence (
    visit_occurrence_id,
    person_id,
    visit_concept_id,
    visit_start_date,
    visit_end_date,
    visit_type_concept_id,
    visit_source_value,
    visit_source_concept_id
)
SELECT
    c.id AS visit_occurrence_id,
    COALESCE(p.person_id, 0) AS person_id,
    COALESCE(std.concept_id, 0) AS visit_concept_id,
    c.statement_date AS visit_start_date,
    c.statement_date AS visit_end_date,
    32035 AS visit_type_concept_id,
    c.place_of_service AS visit_source_value,
    src.concept_id AS visit_source_concept_id
FROM ${parameters.source_schema}.fmt_837_claim c
LEFT JOIN ${parameters.cdm_schema}.person p
    ON p.person_source_value = c.patient_id
LEFT JOIN ${parameters.vocab_schema}.concept src
    ON src.vocabulary_id = 'CMS Place of Service'
    AND src.concept_code = c.place_of_service
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = src.concept_id
    AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept std
    ON std.concept_id = cr.concept_id_2
    AND std.standard_concept = 'S'
ON CONFLICT (visit_occurrence_id) DO NOTHING;
