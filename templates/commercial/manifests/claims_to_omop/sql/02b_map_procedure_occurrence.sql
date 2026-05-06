-- Phase 3 Plan 1 Task 9: 837 → PROCEDURE_OCCURRENCE.
--
-- Each fmt_837_line row projects to one procedure_occurrence row. The
-- procedure_concept_id is the standard concept reached by joining
-- vocab.concept on (vocabulary_id IN ('CPT4', 'HCPCS', 'CDT'), concept_code = procedure_code)
-- and traversing concept_relationship 'Maps to' to a standard concept.
--
-- procedure_type_concept_id = 32868 ('Procedure recorded as billing
-- claim') — the OHDSI-blessed type for claim-derived procedures.
--
-- visit_occurrence_id ties the line back to the claim's visit row
-- (allocated in 02a from fmt_837_claim.id, joined via claim_id).

INSERT INTO ${parameters.cdm_schema}.procedure_occurrence (
    procedure_occurrence_id,
    person_id,
    procedure_concept_id,
    procedure_date,
    procedure_end_date,
    procedure_type_concept_id,
    quantity,
    visit_occurrence_id,
    procedure_source_value,
    procedure_source_concept_id
)
SELECT
    l.id AS procedure_occurrence_id,
    v.person_id,
    COALESCE(std.concept_id, 0) AS procedure_concept_id,
    l.service_date_from AS procedure_date,
    l.service_date_to AS procedure_end_date,
    32868 AS procedure_type_concept_id,
    CAST(l.units AS INTEGER) AS quantity,
    v.visit_occurrence_id,
    l.procedure_code AS procedure_source_value,
    src.concept_id AS procedure_source_concept_id
FROM ${parameters.source_schema}.fmt_837_line l
JOIN ${parameters.source_schema}.fmt_837_claim c ON c.claim_id = l.claim_id
JOIN ${parameters.cdm_schema}.visit_occurrence v ON v.visit_occurrence_id = c.id
LEFT JOIN ${parameters.vocab_schema}.concept src
    ON src.vocabulary_id IN ('CPT4', 'HCPCS', 'CDT')
    AND src.concept_code = l.procedure_code
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = src.concept_id
    AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept std
    ON std.concept_id = cr.concept_id_2
    AND std.standard_concept = 'S'
ON CONFLICT (procedure_occurrence_id) DO NOTHING;
