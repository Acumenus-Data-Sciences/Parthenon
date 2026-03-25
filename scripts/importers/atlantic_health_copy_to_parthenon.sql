-- ============================================================
-- Copy AtlanticHealth inpatient-filtered data from zephyrus to parthenon
-- Uses dblink (same PostgreSQL server, cross-database copy)
-- Target: parthenon.atlantic_health.*
-- ============================================================

-- Connection string for zephyrus DB on same server
-- dblink connection uses local socket since same PG instance

\set conn 'dbname=zephyrus user=smudoshi password=acumenus'

-- ============================================================
-- 1. PATIENTS (243K)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.patients CASCADE;
SELECT * INTO atlantic_health.patients
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT a.subject_id
        FROM mimic_final.admissions a
        WHERE a.admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND a.hadm_id IS NOT NULL
    )
    SELECT p.subject_id::bigint, p.gender::text, p.dob::text, p.dod::text,
           p.language::text, p.marital_status::text, p.race::text,
           p.src_pat_id::text, p.src_epic_pat_id::text, p.mrn::text,
           p.data_origin::text
    FROM mimic_final.patients p
    WHERE p.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, gender text, dob text, dod text,
    language text, marital_status text, race text,
    src_pat_id text, src_epic_pat_id text, mrn text,
    data_origin text
);
CREATE INDEX idx_ah_pat_sid ON atlantic_health.patients (subject_id);

\echo 'Patients copied'

-- ============================================================
-- 2. ADMISSIONS (650K) — only inpatient types with valid hadm_id
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.admissions CASCADE;
SELECT * INTO atlantic_health.admissions
FROM dblink(:'conn', $$
    SELECT a.subject_id::bigint, a.hadm_id::bigint,
           a.admittime::text, a.dischtime::text, a.deathtime::text,
           a.admission_type::text, a.admission_location::text, a.discharge_location::text,
           a.language::text, a.marital_status::text, a.race::text,
           a.edregtime::text, a.edouttime::text,
           a.hospital_expire_flag::text,
           a.data_origin::text
    FROM mimic_final.admissions a
    WHERE a.subject_id IN (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    AND a.hadm_id IS NOT NULL
$$) AS t(
    subject_id bigint, hadm_id bigint,
    admittime text, dischtime text, deathtime text,
    admission_type text, admission_location text, discharge_location text,
    language text, marital_status text, race text,
    edregtime text, edouttime text,
    hospital_expire_flag text,
    data_origin text
);
CREATE INDEX idx_ah_adm_sid ON atlantic_health.admissions (subject_id);
CREATE INDEX idx_ah_adm_hid ON atlantic_health.admissions (hadm_id);

\echo 'Admissions copied'

-- ============================================================
-- 3. TRANSFERS (3.9M)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.transfers CASCADE;
SELECT * INTO atlantic_health.transfers
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT t.subject_id::bigint, t.hadm_id::bigint, t.transfer_id::bigint,
           t.intime::text, t.outtime::text, t.careunit::text,
           t.department_id::text, t.loc_id::text, t.room_id::text, t.bed_id::text,
           t.event_type_c::text, t.data_origin::text
    FROM mimic_final.transfers t
    WHERE t.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint, transfer_id bigint,
    intime text, outtime text, careunit text,
    department_id text, loc_id text, room_id text, bed_id text,
    event_type_c text, data_origin text
);
CREATE INDEX idx_ah_xfr_sid ON atlantic_health.transfers (subject_id);
CREATE INDEX idx_ah_xfr_hid ON atlantic_health.transfers (hadm_id);

\echo 'Transfers copied'

-- ============================================================
-- 4. ICU STAYS (1.9K)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.icustays CASCADE;
SELECT * INTO atlantic_health.icustays
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT i.stay_id::bigint, i.subject_id::bigint, i.hadm_id::bigint,
           i.first_careunit::text, i.last_careunit::text,
           i.intime::text, i.outtime::text, i.los::text,
           i.data_origin::text
    FROM mimic_final.icustays i
    WHERE i.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    stay_id bigint, subject_id bigint, hadm_id bigint,
    first_careunit text, last_careunit text,
    intime text, outtime text, los text,
    data_origin text
);
CREATE INDEX idx_ah_icu_sid ON atlantic_health.icustays (subject_id);

\echo 'ICU stays copied'

-- ============================================================
-- 5. DIAGNOSES_ICD (119K)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.diagnoses_icd CASCADE;
SELECT * INTO atlantic_health.diagnoses_icd
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT d.subject_id::bigint, d.hadm_id::bigint,
           d.seq_num::text, d.chartdate::text, d.icd_code::text, d.icd_version::text,
           d.data_origin::text
    FROM mimic_final.diagnoses_icd d
    WHERE d.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint,
    seq_num text, chartdate text, icd_code text, icd_version text,
    data_origin text
);
CREATE INDEX idx_ah_dxicd_sid ON atlantic_health.diagnoses_icd (subject_id);
CREATE INDEX idx_ah_dxicd_hid ON atlantic_health.diagnoses_icd (hadm_id);

\echo 'Diagnoses copied'

-- ============================================================
-- 6. PRESCRIPTIONS (13.6M)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.prescriptions CASCADE;
SELECT * INTO atlantic_health.prescriptions
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT p.subject_id::bigint, p.hadm_id::bigint,
           p.pharmacy_id::text, p.starttime::text, p.stoptime::text,
           p.drug_type::text, p.drug::text, p.gsn::text, p.ndc::text,
           p.prod_strength::text, p.form_rx::text,
           p.dose_val_rx::text, p.dose_unit_rx::text,
           p.form_val_disp::text, p.form_unit_disp::text,
           p.doses_per_24_hrs::text, p.route::text,
           p.data_origin::text
    FROM mimic_final.prescriptions p
    WHERE p.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint,
    pharmacy_id text, starttime text, stoptime text,
    drug_type text, drug text, gsn text, ndc text,
    prod_strength text, form_rx text,
    dose_val_rx text, dose_unit_rx text,
    form_val_disp text, form_unit_disp text,
    doses_per_24_hrs text, route text,
    data_origin text
);
CREATE INDEX idx_ah_rx_sid ON atlantic_health.prescriptions (subject_id);
CREATE INDEX idx_ah_rx_hid ON atlantic_health.prescriptions (hadm_id);

\echo 'Prescriptions copied'

-- ============================================================
-- 7. SERVICES (936K)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.services CASCADE;
SELECT * INTO atlantic_health.services
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT s.subject_id::bigint, s.hadm_id::bigint,
           s.transfertime::text, s.prev_service::text, s.curr_service::text,
           s.data_origin::text
    FROM mimic_final.services s
    WHERE s.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint,
    transfertime text, prev_service text, curr_service text,
    data_origin text
);
CREATE INDEX idx_ah_svc_sid ON atlantic_health.services (subject_id);

\echo 'Services copied'

-- ============================================================
-- 8. LABEVENTS (5.2M)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.labevents CASCADE;
SELECT * INTO atlantic_health.labevents
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT l.subject_id::bigint, l.hadm_id::bigint, l.stay_id::bigint,
           l.charttime::text, l.itemid::text, l.label::text,
           l.value::text, l.valuenum::text, l.valueuom::text,
           l.flag::text, l.specimen::text,
           l.data_origin::text
    FROM mimic_final.labevents l
    WHERE l.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint, stay_id bigint,
    charttime text, itemid text, label text,
    value text, valuenum text, valueuom text,
    flag text, specimen text,
    data_origin text
);
CREATE INDEX idx_ah_lab_sid ON atlantic_health.labevents (subject_id);
CREATE INDEX idx_ah_lab_hid ON atlantic_health.labevents (hadm_id);

\echo 'Labevents copied'

-- ============================================================
-- 9. EMAR (2.1M)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.emar CASCADE;
SELECT * INTO atlantic_health.emar
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT e.subject_id::bigint, e.hadm_id::bigint, e.stay_id::bigint,
           e.charttime::text, e.medication::text, e.route::text,
           e.action::text, e.status::text,
           e.dose::text, e.dose_unit::text,
           e.data_origin::text
    FROM mimic_final.emar e
    WHERE e.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint, stay_id bigint,
    charttime text, medication text, route text,
    action text, status text,
    dose text, dose_unit text,
    data_origin text
);
CREATE INDEX idx_ah_emar_sid ON atlantic_health.emar (subject_id);
CREATE INDEX idx_ah_emar_hid ON atlantic_health.emar (hadm_id);

\echo 'EMAR copied'

-- ============================================================
-- 10. CHARTEVENTS (23.2M — largest table)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.chartevents CASCADE;
SELECT * INTO atlantic_health.chartevents
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT c.subject_id::bigint, c.hadm_id::bigint, c.stay_id::bigint,
           c.charttime::text, c.itemid::text, c.label::text,
           c.value::text, c.valuenum::text, c.valueuom::text,
           c.data_origin::text
    FROM mimic_final.chartevents c
    WHERE c.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint, stay_id bigint,
    charttime text, itemid text, label text,
    value text, valuenum text, valueuom text,
    data_origin text
);
CREATE INDEX idx_ah_chart_sid ON atlantic_health.chartevents (subject_id);
CREATE INDEX idx_ah_chart_hid ON atlantic_health.chartevents (hadm_id);

\echo 'Chartevents copied'

-- ============================================================
-- 11. PROBLEM_LIST (827K)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.problem_list CASCADE;
SELECT * INTO atlantic_health.problem_list
FROM dblink(:'conn', $$
    WITH ip_subjects AS (
        SELECT DISTINCT subject_id FROM mimic_final.admissions
        WHERE admission_type IN ('INPATIENT','EMERGENCY','OBSERVATION','MOBILE INTENSIVE CARE UNIT',
            'INPATIENT PSYCH','INPATIENT REHAB','LTACH IP','SURGERY ADMIT','NEWBORN')
        AND hadm_id IS NOT NULL
    )
    SELECT pl.subject_id::bigint, pl.hadm_id::bigint, pl.problem_id::bigint,
           pl.dx_id::text, pl.icd9_code::text, pl.diagnosis_code::text,
           pl.current_icd10_list::text, pl.diagnosis_name::text,
           pl.starttime::text, pl.endtime::text, pl.status::text,
           pl.chronic_yn::text, pl.data_origin::text
    FROM mimic_final.problem_list pl
    WHERE pl.subject_id IN (SELECT subject_id FROM ip_subjects)
$$) AS t(
    subject_id bigint, hadm_id bigint, problem_id bigint,
    dx_id text, icd9_code text, diagnosis_code text,
    current_icd10_list text, diagnosis_name text,
    starttime text, endtime text, status text,
    chronic_yn text, data_origin text
);
CREATE INDEX idx_ah_pl_sid ON atlantic_health.problem_list (subject_id);

\echo 'Problem list copied'

-- ============================================================
-- 12. D_LABITEMS + D_ITEMS (reference, small)
-- ============================================================
DROP TABLE IF EXISTS atlantic_health.d_labitems CASCADE;
SELECT * INTO atlantic_health.d_labitems
FROM dblink(:'conn', $$
    SELECT itemid::text, label::text, fluid::text, category::text
    FROM mimic_final.d_labitems
$$) AS t(itemid text, label text, fluid text, category text);

DROP TABLE IF EXISTS atlantic_health.d_items CASCADE;
SELECT * INTO atlantic_health.d_items
FROM dblink(:'conn', $$
    SELECT itemid::text, label::text, abbreviation::text, linksto::text,
           category::text, unitname::text, param_type::text,
           lownormalvalue::text, highnormalvalue::text
    FROM mimic_final.d_items
$$) AS t(itemid text, label text, abbreviation text, linksto text,
         category text, unitname text, param_type text,
         lownormalvalue text, highnormalvalue text);

\echo 'Reference tables copied'

-- ============================================================
-- Verification
-- ============================================================
SELECT 'patients' as tbl, count(*) FROM atlantic_health.patients
UNION ALL SELECT 'admissions', count(*) FROM atlantic_health.admissions
UNION ALL SELECT 'transfers', count(*) FROM atlantic_health.transfers
UNION ALL SELECT 'icustays', count(*) FROM atlantic_health.icustays
UNION ALL SELECT 'diagnoses_icd', count(*) FROM atlantic_health.diagnoses_icd
UNION ALL SELECT 'prescriptions', count(*) FROM atlantic_health.prescriptions
UNION ALL SELECT 'services', count(*) FROM atlantic_health.services
UNION ALL SELECT 'labevents', count(*) FROM atlantic_health.labevents
UNION ALL SELECT 'emar', count(*) FROM atlantic_health.emar
UNION ALL SELECT 'chartevents', count(*) FROM atlantic_health.chartevents
UNION ALL SELECT 'problem_list', count(*) FROM atlantic_health.problem_list
UNION ALL SELECT 'd_labitems', count(*) FROM atlantic_health.d_labitems
UNION ALL SELECT 'd_items', count(*) FROM atlantic_health.d_items
ORDER BY tbl;
