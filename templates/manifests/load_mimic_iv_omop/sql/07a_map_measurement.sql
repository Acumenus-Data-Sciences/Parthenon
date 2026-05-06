-- Phase 2 Plan 4 Task 10: MEASUREMENT mapper (Stage 6a — labevents).
-- labevents.loinc_code → LOINC concept_id; valuenum/valueuom → value_as_number/unit.

INSERT INTO ${parameters.target_schema}.measurement (
    person_id,
    measurement_concept_id,
    measurement_date,
    measurement_datetime,
    measurement_type_concept_id,
    value_as_number,
    unit_concept_id,
    range_low,
    range_high,
    visit_occurrence_id,
    measurement_source_value,
    unit_source_value,
    value_source_value
)
SELECT
    le.subject_id,
    COALESCE(l.target_concept_id, 0) AS measurement_concept_id,
    DATE(le.charttime),
    le.charttime,
    32817 AS measurement_type_concept_id,
    le.valuenum,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'UCUM' AND concept_code = le.valueuom LIMIT 1),
        0
    ) AS unit_concept_id,
    le.ref_range_lower,
    le.ref_range_upper,
    le.hadm_id,
    le.loinc_code,
    le.valueuom,
    le.value
FROM mimic_iv_source.fmt_labevents le
LEFT JOIN mimic_iv_source.lkp_loinc_for_lab l ON l.loinc_code = le.loinc_code;
