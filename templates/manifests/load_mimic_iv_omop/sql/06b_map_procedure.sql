-- Phase 2 Plan 4 Task 9: PROCEDURE_OCCURRENCE mapper (Stage 5b).
-- procedures_icd JOIN icd9-pcs/icd10-pcs lookups → procedure_occurrence.

INSERT INTO ${parameters.target_schema}.procedure_occurrence (
    person_id,
    procedure_concept_id,
    procedure_date,
    procedure_type_concept_id,
    visit_occurrence_id,
    procedure_source_value
)
SELECT
    p.subject_id,
    COALESCE(
        CASE p.icd_version
            WHEN 9 THEN (SELECT target_concept_id FROM mimic_iv_source.lkp_icd9_pcs_to_snomed_procedure WHERE source_code = p.icd_code LIMIT 1)
            WHEN 10 THEN (SELECT target_concept_id FROM mimic_iv_source.lkp_icd10_pcs_to_snomed_procedure WHERE source_code = p.icd_code LIMIT 1)
        END,
        0
    ) AS procedure_concept_id,
    COALESCE(p.chartdate, DATE(a.admittime)) AS procedure_date,
    32817 AS procedure_type_concept_id,
    p.hadm_id AS visit_occurrence_id,
    p.icd_code AS procedure_source_value
FROM mimic_iv_source.fmt_procedures_icd p
JOIN mimic_iv_source.fmt_admissions a ON a.hadm_id = p.hadm_id;
