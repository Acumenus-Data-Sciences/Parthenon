-- Phase 3 Plan 4C Task 4: COPY NCDR CSV into fmt_ncdr_pci.

COPY ${parameters.source_schema}.fmt_ncdr_pci (
    record_id, patient_id, procedure_date, patient_age, gender,
    hospital_id, operator_npi, preop_diagnosis_icd10,
    ejection_fraction, cardiac_index, lesion_count, lesion_segments,
    primary_procedure_code, stent_count, stent_udis, stent_types,
    postop_bleeding, postop_aki, postop_stroke,
    length_of_stay, mortality_in_hospital, source_file
)
FROM '${parameters.ncdr_csv}'
WITH (FORMAT csv, HEADER true, NULL '');
