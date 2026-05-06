-- Phase 2 Plan 6 Task 9: CM → DRUG_EXPOSURE.
-- CMTRT (preferred name) → RxNorm Ingredient via vocab.concept lookup.
-- CMSTDTC/CMENDTC → drug_exposure_start/end_date.

INSERT INTO ${parameters.cdm_schema}.drug_exposure (
    person_id,
    drug_concept_id,
    drug_exposure_start_date,
    drug_exposure_end_date,
    drug_type_concept_id,
    quantity,
    drug_source_value,
    dose_unit_source_value
)
SELECT
    p.person_id,
    COALESCE(c.concept_id, 0) AS drug_concept_id,
    NULLIF(cm.CMSTDTC, '')::DATE AS drug_exposure_start_date,
    NULLIF(cm.CMENDTC, '')::DATE AS drug_exposure_end_date,
    38000177 AS drug_type_concept_id,  -- 'Prescription written'
    cm.CMDOSE AS quantity,
    cm.CMTRT AS drug_source_value,
    cm.CMDOSU AS dose_unit_source_value
FROM sdtm_source.fmt_cm cm
JOIN ${parameters.cdm_schema}.person p ON p.person_source_value = cm.USUBJID
LEFT JOIN ${parameters.vocab_schema}.concept c
    ON c.vocabulary_id = 'RxNorm'
    AND c.concept_class_id IN ('Ingredient', 'Brand Name', 'Clinical Drug')
    AND c.concept_name ILIKE cm.CMTRT
    AND c.standard_concept = 'S'
WHERE NULLIF(cm.CMSTDTC, '') IS NOT NULL;
