-- Phase 3 Plan 4B Task 4 (T-022B): COPY STS CSV into fmt_sts_surgery.
-- The reader (production path) writes here directly via psycopg's COPY;
-- the validation E2E populates via INSERT VALUES.

COPY ${parameters.source_schema}.fmt_sts_surgery (
    record_id, patient_id, surgery_date, patient_age, gender,
    hospital_id, surgeon_id, ejection_fraction, nyha_class,
    primary_diagnosis_icd10, secondary_diagnoses_icd10,
    procedure_category, primary_procedure_code, secondary_procedure_codes,
    postop_aki, postop_stroke, postop_reoperation, postop_sepsis,
    length_of_stay, discharge_disposition, mortality_30day, source_file
)
FROM '${parameters.sts_csv}'
WITH (FORMAT csv, HEADER true, NULL '');
