-- ============================================================
-- AtlanticHealth Phase 1: Derive Missing Tables from Observed Data
-- Target database: zephyrus
-- Source: mimic_export.* (proper types: timestamp, bigint, boolean)
-- Output: mimic_final.* (new materialized tables)
-- ============================================================

-- Run without transaction so partial progress is preserved
-- Each table is independent

-- ============================================================
-- 1. ICU STAYS (from transfers where level_of_care = ICU)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.icustays CASCADE;
CREATE TABLE mimic_final.icustays AS
WITH icu_events AS (
    SELECT
        mt.subject_id,
        mt.hadm_id,
        mt.transfer_id,
        mt.eventtime,
        mt.department_id,
        CASE WHEN mt.pat_lvl_of_care_c = '6' THEN true ELSE false END AS is_icu,
        ROW_NUMBER() OVER (PARTITION BY mt.subject_id, mt.hadm_id ORDER BY mt.eventtime) AS rn,
        ROW_NUMBER() OVER (PARTITION BY mt.subject_id, mt.hadm_id,
            CASE WHEN mt.pat_lvl_of_care_c = '6' THEN 1 ELSE 0 END
            ORDER BY mt.eventtime) AS grp_rn
    FROM mimic_export.mimic_transfers mt
    WHERE mt.subject_id IS NOT NULL
      AND mt.eventtime IS NOT NULL
),
icu_groups AS (
    SELECT
        subject_id, hadm_id, eventtime, department_id, is_icu,
        rn - grp_rn AS stay_group
    FROM icu_events
),
icu_stays_raw AS (
    SELECT
        subject_id,
        hadm_id,
        MIN(eventtime) AS intime,
        MAX(eventtime) AS outtime_raw,
        count(*) AS event_count
    FROM icu_groups
    WHERE is_icu = true
    GROUP BY subject_id, hadm_id, stay_group
)
SELECT
    ROW_NUMBER() OVER (ORDER BY subject_id, intime)::bigint AS stay_id,
    subject_id,
    hadm_id,
    'ICU'::text AS first_careunit,
    'ICU'::text AS last_careunit,
    intime,
    CASE WHEN outtime_raw = intime THEN intime + INTERVAL '48 hours'
         ELSE outtime_raw END AS outtime,
    ROUND(EXTRACT(EPOCH FROM (
        CASE WHEN outtime_raw = intime THEN intime + INTERVAL '48 hours'
             ELSE outtime_raw END - intime
    )) / 86400.0, 2)::text AS los,
    'derived'::text AS data_origin
FROM icu_stays_raw;

CREATE INDEX idx_ah_icu_subject ON mimic_final.icustays (subject_id);
CREATE INDEX idx_ah_icu_hadm ON mimic_final.icustays (hadm_id);

DO $$ BEGIN RAISE NOTICE 'ICU stays: % rows', (SELECT count(*) FROM mimic_final.icustays); END $$;

-- ============================================================
-- 2. DIAGNOSES_ICD (from problem_list + admissions overlap)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.diagnoses_icd CASCADE;
CREATE TABLE mimic_final.diagnoses_icd AS
WITH problems_with_icd AS (
    SELECT
        pl.subject_id,
        pl.hadm_id AS problem_hadm_id,
        pl.current_icd10_list AS icd_code,
        '10'::text AS icd_version,
        pl.diagnosis_name,
        pl.chronic_yn,
        pl.is_present_on_adm_c,
        pl.starttime
    FROM mimic_export.mimic_problem_list pl
    WHERE pl.current_icd10_list IS NOT NULL
      AND pl.current_icd10_list != ''
      AND pl.current_icd10_list != '\N'
),
-- For problems without hadm_id, map to admissions by temporal overlap
mapped AS (
    SELECT DISTINCT ON (p.subject_id, COALESCE(p.problem_hadm_id, a.hadm_id), p.icd_code)
        p.subject_id,
        COALESCE(p.problem_hadm_id, a.hadm_id) AS hadm_id,
        p.icd_code,
        p.icd_version,
        p.diagnosis_name,
        p.is_present_on_adm_c
    FROM problems_with_icd p
    LEFT JOIN mimic_export.mimic_admissions a
        ON p.subject_id = a.subject_id
        AND p.problem_hadm_id IS NULL
        AND p.starttime IS NOT NULL
        AND a.admittime IS NOT NULL
        AND p.starttime BETWEEN a.admittime - INTERVAL '30 days' AND a.dischtime
    WHERE COALESCE(p.problem_hadm_id, a.hadm_id) IS NOT NULL
)
SELECT
    subject_id,
    hadm_id,
    (ROW_NUMBER() OVER (
        PARTITION BY subject_id, hadm_id
        ORDER BY
            CASE WHEN is_present_on_adm_c = '1' THEN 0 ELSE 1 END,
            icd_code
    ))::text AS seq_num,
    NULL::text AS chartdate,
    icd_code,
    icd_version,
    'derived'::text AS data_origin
FROM mapped;

CREATE INDEX idx_ah_dx_subject ON mimic_final.diagnoses_icd (subject_id);
CREATE INDEX idx_ah_dx_hadm ON mimic_final.diagnoses_icd (hadm_id);

DO $$ BEGIN RAISE NOTICE 'Diagnoses: % rows', (SELECT count(*) FROM mimic_final.diagnoses_icd); END $$;

-- ============================================================
-- 3. PRESCRIPTIONS (from medication orders)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.prescriptions CASCADE;
CREATE TABLE mimic_final.prescriptions AS
SELECT
    o.subject_id,
    o.hadm_id,
    o.order_id::text AS pharmacy_id,
    o.ordertime::text AS starttime,
    o.resulttime::text AS stoptime,
    'inpatient'::text AS drug_type,
    COALESCE(NULLIF(o.med_name, '\N'), NULLIF(o.med_name, ''), o.order_name) AS drug,
    NULL::text AS gsn,
    NULL::text AS ndc,
    NULL::text AS prod_strength,
    NULL::text AS form_rx,
    NULLIF(o.dose, '\N') AS dose_val_rx,
    NULL::text AS dose_unit_rx,
    NULL::text AS form_val_disp,
    NULL::text AS form_unit_disp,
    NULL::text AS doses_per_24_hrs,
    NULL::text AS route,
    'derived'::text AS data_origin
FROM mimic_export.mimic_orders o
WHERE o.is_medication_order = true
  AND o.ordertime IS NOT NULL
  AND (o.med_name IS NOT NULL AND o.med_name != '' AND o.med_name != '\N'
       OR o.order_name IS NOT NULL AND o.order_name != '' AND o.order_name != '\N');

CREATE INDEX idx_ah_rx_subject ON mimic_final.prescriptions (subject_id);
CREATE INDEX idx_ah_rx_hadm ON mimic_final.prescriptions (hadm_id);

DO $$ BEGIN RAISE NOTICE 'Prescriptions: % rows', (SELECT count(*) FROM mimic_final.prescriptions); END $$;

-- ============================================================
-- 4. SERVICES (from careunit transitions in transfers)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.services CASCADE;
CREATE TABLE mimic_final.services AS
WITH transfers_with_lag AS (
    SELECT
        t.subject_id,
        t.hadm_id,
        t.intime AS transfertime,
        t.careunit,
        LAG(t.careunit) OVER (PARTITION BY t.subject_id, t.hadm_id ORDER BY t.intime) AS prev_careunit
    FROM mimic_final.transfers t
    WHERE t.hadm_id IS NOT NULL
      AND t.careunit IS NOT NULL
      AND t.careunit != '\N'
)
SELECT
    subject_id,
    hadm_id,
    transfertime::text AS transfertime,
    COALESCE(prev_careunit, 'ADMIT') AS prev_service,
    careunit AS curr_service,
    'derived'::text AS data_origin
FROM transfers_with_lag
WHERE prev_careunit IS NULL OR prev_careunit != careunit;

CREATE INDEX idx_ah_svc_subject ON mimic_final.services (subject_id);

DO $$ BEGIN RAISE NOTICE 'Services: % rows', (SELECT count(*) FROM mimic_final.services); END $$;

-- ============================================================
-- 5. D_LABITEMS (reference dictionary)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.d_labitems CASCADE;
CREATE TABLE mimic_final.d_labitems AS
SELECT DISTINCT
    itemid,
    label,
    COALESCE(specimen, 'Unknown') AS fluid,
    'Lab'::text AS category
FROM mimic_final.labevents
WHERE itemid IS NOT NULL;

DO $$ BEGIN RAISE NOTICE 'd_labitems: % rows', (SELECT count(*) FROM mimic_final.d_labitems); END $$;

-- ============================================================
-- 6. D_ITEMS (combined reference dictionary)
-- ============================================================
DROP TABLE IF EXISTS mimic_final.d_items CASCADE;
CREATE TABLE mimic_final.d_items AS
SELECT DISTINCT ON (itemid)
    itemid,
    label,
    label AS abbreviation,
    'chartevents'::text AS linksto,
    'Vitals'::text AS category,
    valueuom AS unitname,
    'Numeric'::text AS param_type,
    NULL::text AS lownormalvalue,
    NULL::text AS highnormalvalue
FROM mimic_final.chartevents
WHERE itemid IS NOT NULL
UNION ALL
SELECT DISTINCT ON (itemid)
    itemid,
    label,
    label AS abbreviation,
    'labevents'::text AS linksto,
    'Lab'::text AS category,
    valueuom AS unitname,
    'Numeric'::text AS param_type,
    NULL::text AS lownormalvalue,
    NULL::text AS highnormalvalue
FROM mimic_final.labevents
WHERE itemid IS NOT NULL;

DO $$ BEGIN RAISE NOTICE 'd_items: % rows', (SELECT count(*) FROM mimic_final.d_items); END $$;

-- ============================================================
-- 7. Update dataset_catalog
-- ============================================================
INSERT INTO mimic_final.dataset_catalog (object_name, object_type, source_schema, provenance, row_count, notes)
VALUES
    ('icustays', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.icustays), 'Derived from transfers where pat_lvl_of_care_c=6 (ICU)'),
    ('diagnoses_icd', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.diagnoses_icd), 'Derived from problem_list mapped to admissions by temporal overlap'),
    ('prescriptions', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.prescriptions), 'Derived from orders where is_medication_order=true'),
    ('services', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.services), 'Derived from careunit transitions in transfers'),
    ('d_labitems', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.d_labitems), 'Reference dictionary from synthetic labevents'),
    ('d_items', 'table', 'mimic_final', 'derived', (SELECT count(*) FROM mimic_final.d_items), 'Reference dictionary from chartevents + labevents')
ON CONFLICT (object_name) DO UPDATE SET
    row_count = EXCLUDED.row_count,
    notes = EXCLUDED.notes;

-- ============================================================
-- Final Verification
-- ============================================================
SELECT object_name, provenance, row_count, notes
FROM mimic_final.dataset_catalog
ORDER BY provenance, object_name;
