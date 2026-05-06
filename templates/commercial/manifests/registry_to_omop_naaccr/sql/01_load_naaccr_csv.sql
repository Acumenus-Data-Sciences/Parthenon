-- Phase 3 Plan 4A Task 4 (T-022A): load fmt_naaccr_record from CSV.
--
-- Caller passes ``${parameters.naaccr_csv}`` pointing at the converted
-- CSV (NAACCRReader's flat-file output). The runner exposes the path
-- to the SQL stage so postgres' COPY can ingest directly.
--
-- For the validation E2E this stage is bypassed — the test populates
-- the table via INSERT VALUES so we don't need a real file path.

COPY ${parameters.source_schema}.fmt_naaccr_record (
    patient_id_number,
    tumor_record_number,
    name_last,
    name_first,
    date_of_birth,
    sex,
    race_1,
    spanish_hispanic_origin,
    primary_site,
    histologic_type_icdo3,
    behavior_code_icdo3,
    grade,
    date_of_diagnosis,
    diagnostic_confirmation,
    ajcc_stage_group,
    ajcc_t,
    ajcc_n,
    ajcc_m,
    rx_summary_surgery,
    rx_summary_chemo,
    rx_summary_radiation,
    rx_summary_hormone,
    vital_status,
    date_of_last_contact,
    cause_of_death,
    source_file
)
FROM '${parameters.naaccr_csv}'
WITH (FORMAT csv, HEADER true, NULL '');
