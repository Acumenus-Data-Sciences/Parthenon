-- Phase 2 Plan 4 Task 11: DRUG_EXPOSURE mapper (Stage 6b — prescriptions).
-- NDC primary, RxNorm fallback. starttime/stoptime → drug_exposure_start/end_datetime.

INSERT INTO ${parameters.target_schema}.drug_exposure (
    person_id,
    drug_concept_id,
    drug_exposure_start_date,
    drug_exposure_start_datetime,
    drug_exposure_end_date,
    drug_exposure_end_datetime,
    drug_type_concept_id,
    quantity,
    visit_occurrence_id,
    drug_source_value,
    dose_unit_source_value
)
SELECT
    rx.subject_id,
    COALESCE(
        (SELECT target_concept_id FROM mimic_iv_source.lkp_ndc_for_drug WHERE ndc_code = rx.ndc LIMIT 1),
        (SELECT target_concept_id FROM mimic_iv_source.lkp_rxnorm_for_med WHERE rxnorm_code = rx.rxnorm_code LIMIT 1),
        0
    ) AS drug_concept_id,
    DATE(rx.starttime),
    rx.starttime,
    DATE(rx.stoptime),
    rx.stoptime,
    38000177 AS drug_type_concept_id,  -- 'Prescription written'
    NULLIF(REGEXP_REPLACE(rx.dose_val_rx, '[^0-9.]', '', 'g'), '')::NUMERIC AS quantity,
    rx.hadm_id,
    rx.drug,
    rx.dose_unit_rx
FROM mimic_iv_source.fmt_prescriptions rx;
