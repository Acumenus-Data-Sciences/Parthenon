-- Phase 2 Plan 4 Task 8: CONDITION_OCCURRENCE mapper (Stage 5a).
-- diagnoses_icd JOIN icd9/icd10 lookups → condition_occurrence.
-- Unmapped codes go to app.unmapped_concepts_queue (Phase 1 PR-A pattern).

INSERT INTO ${parameters.target_schema}.condition_occurrence (
    person_id,
    condition_concept_id,
    condition_start_date,
    condition_type_concept_id,
    visit_occurrence_id,
    condition_source_value
)
SELECT
    d.subject_id,
    COALESCE(
        CASE d.icd_version
            WHEN 9 THEN (SELECT target_concept_id FROM mimic_iv_source.lkp_icd9_to_snomed_condition WHERE source_code = d.icd_code LIMIT 1)
            WHEN 10 THEN (SELECT target_concept_id FROM mimic_iv_source.lkp_icd10_to_snomed_condition WHERE source_code = d.icd_code LIMIT 1)
        END,
        0
    ) AS condition_concept_id,
    DATE(a.admittime) AS condition_start_date,
    32817 AS condition_type_concept_id,  -- 'EHR'
    d.hadm_id AS visit_occurrence_id,
    d.icd_code AS condition_source_value
FROM mimic_iv_source.fmt_diagnoses_icd d
JOIN mimic_iv_source.fmt_admissions a ON a.hadm_id = d.hadm_id;

-- Log unmapped codes for human review (Phase 1 unmapped_concepts_queue).
INSERT INTO ${parameters.app_schema}.unmapped_concepts_queue (
    run_id,
    source_system,
    source_code,
    resource_type,
    resource_id,
    occurrence_count
)
SELECT
    '${parameters.run_id}'::uuid,
    CASE d.icd_version WHEN 9 THEN 'ICD9CM' ELSE 'ICD10CM' END,
    d.icd_code,
    'CONDITION_OCCURRENCE',
    CAST(d.hadm_id AS VARCHAR),
    COUNT(*)
FROM mimic_iv_source.fmt_diagnoses_icd d
LEFT JOIN mimic_iv_source.lkp_icd9_to_snomed_condition l9
    ON d.icd_version = 9 AND d.icd_code = l9.source_code
LEFT JOIN mimic_iv_source.lkp_icd10_to_snomed_condition l10
    ON d.icd_version = 10 AND d.icd_code = l10.source_code
WHERE l9.target_concept_id IS NULL
  AND l10.target_concept_id IS NULL
GROUP BY d.icd_version, d.icd_code, d.hadm_id
ON CONFLICT (run_id, source_system, source_code) DO NOTHING;
