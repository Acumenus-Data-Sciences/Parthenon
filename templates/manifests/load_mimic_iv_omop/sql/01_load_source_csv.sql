-- Phase 2 Plan 4 Task 2: bulk-load MIMIC-IV CSVs into fmt_* via COPY.
-- Customer mounts the MIMIC-IV directory at the path passed via parameters.csv_root.

COPY mimic_iv_source.fmt_patients
FROM '${parameters.csv_root}/hosp/patients.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_admissions
FROM '${parameters.csv_root}/hosp/admissions.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_transfers
FROM '${parameters.csv_root}/hosp/transfers.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_diagnoses_icd
FROM '${parameters.csv_root}/hosp/diagnoses_icd.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_procedures_icd
FROM '${parameters.csv_root}/hosp/procedures_icd.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_labevents
FROM '${parameters.csv_root}/hosp/labevents.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_prescriptions
FROM '${parameters.csv_root}/hosp/prescriptions.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_chartevents
FROM '${parameters.csv_root}/icu/chartevents.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_noteevents
FROM '${parameters.csv_root}/note/noteevents.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_drgcodes
FROM '${parameters.csv_root}/hosp/drgcodes.csv' WITH (FORMAT csv, HEADER);

COPY mimic_iv_source.fmt_icustays
FROM '${parameters.csv_root}/icu/icustays.csv' WITH (FORMAT csv, HEADER);
