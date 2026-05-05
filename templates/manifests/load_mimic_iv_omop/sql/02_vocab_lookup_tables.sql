-- Phase 2 Plan 4 Task 3: build vocabulary lookup tables via JOINs against
-- vocab.concept + vocab.concept_relationship (relationship_id = 'Maps to').
-- Each lookup is small + indexed, so downstream mappers can do simple JOINs.

DROP TABLE IF EXISTS mimic_iv_source.lkp_icd9_to_snomed_condition;
CREATE TABLE mimic_iv_source.lkp_icd9_to_snomed_condition AS
SELECT
    c1.concept_code AS source_code,
    c2.concept_id AS target_concept_id,
    c2.concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept c1
JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'ICD9CM'
  AND c2.standard_concept = 'S'
  AND c2.domain_id = 'Condition';
CREATE INDEX idx_lkp_icd9_cond ON mimic_iv_source.lkp_icd9_to_snomed_condition (source_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_icd10_to_snomed_condition;
CREATE TABLE mimic_iv_source.lkp_icd10_to_snomed_condition AS
SELECT
    c1.concept_code AS source_code,
    c2.concept_id AS target_concept_id,
    c2.concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept c1
JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'ICD10CM'
  AND c2.standard_concept = 'S'
  AND c2.domain_id = 'Condition';
CREATE INDEX idx_lkp_icd10_cond ON mimic_iv_source.lkp_icd10_to_snomed_condition (source_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_icd9_pcs_to_snomed_procedure;
CREATE TABLE mimic_iv_source.lkp_icd9_pcs_to_snomed_procedure AS
SELECT
    c1.concept_code AS source_code,
    c2.concept_id AS target_concept_id,
    c2.concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept c1
JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'ICD9Proc'
  AND c2.standard_concept = 'S'
  AND c2.domain_id = 'Procedure';
CREATE INDEX idx_lkp_icd9pcs_proc ON mimic_iv_source.lkp_icd9_pcs_to_snomed_procedure (source_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_icd10_pcs_to_snomed_procedure;
CREATE TABLE mimic_iv_source.lkp_icd10_pcs_to_snomed_procedure AS
SELECT
    c1.concept_code AS source_code,
    c2.concept_id AS target_concept_id,
    c2.concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept c1
JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'ICD10PCS'
  AND c2.standard_concept = 'S'
  AND c2.domain_id = 'Procedure';
CREATE INDEX idx_lkp_icd10pcs_proc ON mimic_iv_source.lkp_icd10_pcs_to_snomed_procedure (source_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_loinc_for_lab;
CREATE TABLE mimic_iv_source.lkp_loinc_for_lab AS
SELECT concept_code AS loinc_code, concept_id AS target_concept_id, concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept
WHERE vocabulary_id = 'LOINC' AND standard_concept = 'S';
CREATE INDEX idx_lkp_loinc ON mimic_iv_source.lkp_loinc_for_lab (loinc_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_rxnorm_for_med;
CREATE TABLE mimic_iv_source.lkp_rxnorm_for_med AS
SELECT concept_code AS rxnorm_code, concept_id AS target_concept_id, concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept
WHERE vocabulary_id = 'RxNorm' AND standard_concept = 'S';
CREATE INDEX idx_lkp_rxnorm ON mimic_iv_source.lkp_rxnorm_for_med (rxnorm_code);

DROP TABLE IF EXISTS mimic_iv_source.lkp_ndc_for_drug;
CREATE TABLE mimic_iv_source.lkp_ndc_for_drug AS
SELECT
    c1.concept_code AS ndc_code,
    c2.concept_id AS target_concept_id,
    c2.concept_name AS target_concept_name
FROM ${parameters.vocab_schema}.concept c1
JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = c1.concept_id AND cr.relationship_id = 'Maps to'
JOIN ${parameters.vocab_schema}.concept c2
    ON cr.concept_id_2 = c2.concept_id
WHERE c1.vocabulary_id = 'NDC'
  AND c2.standard_concept = 'S'
  AND c2.domain_id = 'Drug';
CREATE INDEX idx_lkp_ndc ON mimic_iv_source.lkp_ndc_for_drug (ndc_code);
