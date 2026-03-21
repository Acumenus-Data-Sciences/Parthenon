#!/bin/bash
# Copy AtlanticHealth inpatient-filtered data from zephyrus to parthenon
# Both databases on pgsql.acumenus.net:5432
set -e

export PGPASSWORD=acumenus
HOST="pgsql.acumenus.net"
USER="smudoshi"
SRC_DB="zephyrus"
DST_DB="parthenon"
SCHEMA="atlantic_health"

src() { psql -h $HOST -p 5432 -U $USER -d $SRC_DB "$@"; }
dst() { psql -h $HOST -p 5432 -U $USER -d $DST_DB "$@"; }

copy_table() {
    local table="$1"
    local query="$2"
    echo -n "  $table... "

    # Drop existing table in destination
    dst -c "DROP TABLE IF EXISTS ${SCHEMA}.${table} CASCADE;" 2>/dev/null

    # Copy via CSV pipe: zephyrus COPY TO → parthenon COPY FROM
    # First row is header, used to create the table structure
    src -c "COPY ($query) TO STDOUT WITH (FORMAT csv, HEADER true)" 2>/dev/null | \
        dst -c "
            CREATE TABLE ${SCHEMA}.${table} AS
            SELECT * FROM read_csv('/dev/stdin') WHERE false;
        " 2>/dev/null || true

    # Actually, simplest approach: create table from first COPY, then use CSV
    # Let's use a two-step: create with header types, then COPY data

    # Step 1: Create table by selecting 0 rows with proper types
    local cols=$(src -t -c "SELECT string_agg(column_name || ' text', ', ') FROM information_schema.columns WHERE table_schema='${SCHEMA}' AND table_name='${table}' ORDER BY ordinal_position" 2>/dev/null)

    # Simpler: just pipe COPY TO → COPY FROM with matching header
    dst -c "DROP TABLE IF EXISTS ${SCHEMA}.${table} CASCADE;" 2>/dev/null

    # Get column count for header
    local header=$(src -c "COPY ($query LIMIT 0) TO STDOUT WITH (FORMAT csv, HEADER true)" 2>/dev/null | head -1)
    local num_cols=$(echo "$header" | awk -F',' '{print NF}')

    # Create all-text table from header
    local create_cols=$(echo "$header" | tr ',' '\n' | sed 's/.*/"&" text/' | tr '\n' ',' | sed 's/,$//')
    dst -c "CREATE TABLE ${SCHEMA}.${table} ($create_cols);" 2>/dev/null

    # Copy data
    src -c "COPY ($query) TO STDOUT WITH (FORMAT csv, HEADER false)" 2>/dev/null | \
        dst -c "COPY ${SCHEMA}.${table} FROM STDIN WITH (FORMAT csv, HEADER false, NULL '')" 2>/dev/null

    local count=$(dst -t -c "SELECT count(*) FROM ${SCHEMA}.${table}" 2>/dev/null | tr -d ' ')
    echo "$count rows"
}

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  AtlanticHealth → parthenon.atlantic_health (inpatient only) ║"
echo "╚═══════════════════════════════════════════════════════════════╝"

# Ensure schema exists
dst -c "CREATE SCHEMA IF NOT EXISTS ${SCHEMA};" 2>/dev/null

# Inpatient subject filter
IP_FILTER="subject_id IN (SELECT subject_id FROM mimic_final._ip_subjects)"

echo "Copying tables..."

copy_table "patients" \
    "SELECT subject_id, gender, dob::text, dod::text, language, marital_status, race, src_pat_id, src_epic_pat_id, mrn, data_origin FROM mimic_final.patients WHERE $IP_FILTER"

copy_table "admissions" \
    "SELECT subject_id, hadm_id, admittime::text, dischtime::text, deathtime::text, admission_type, admission_location, discharge_location, language, marital_status, race, edregtime::text, edouttime::text, hospital_expire_flag, data_origin FROM mimic_final.admissions WHERE $IP_FILTER AND hadm_id IS NOT NULL"

copy_table "transfers" \
    "SELECT subject_id, hadm_id, transfer_id, intime::text, outtime::text, careunit, department_id, loc_id, room_id, bed_id, event_type_c, data_origin FROM mimic_final.transfers WHERE $IP_FILTER"

copy_table "icustays" \
    "SELECT stay_id, subject_id, hadm_id, first_careunit, last_careunit, intime::text, outtime::text, los, data_origin FROM mimic_final.icustays WHERE $IP_FILTER"

copy_table "diagnoses_icd" \
    "SELECT subject_id, hadm_id, seq_num, chartdate, icd_code, icd_version, data_origin FROM mimic_final.diagnoses_icd WHERE $IP_FILTER"

copy_table "prescriptions" \
    "SELECT subject_id, hadm_id, pharmacy_id, starttime, stoptime, drug_type, drug, gsn, ndc, prod_strength, form_rx, dose_val_rx, dose_unit_rx, form_val_disp, form_unit_disp, doses_per_24_hrs, route, data_origin FROM mimic_final.prescriptions WHERE $IP_FILTER"

copy_table "services" \
    "SELECT subject_id, hadm_id, transfertime, prev_service, curr_service, data_origin FROM mimic_final.services WHERE $IP_FILTER"

copy_table "labevents" \
    "SELECT subject_id, hadm_id, stay_id, charttime::text, itemid, label, value, valuenum, valueuom, flag, specimen, data_origin FROM mimic_final.labevents WHERE $IP_FILTER"

copy_table "emar" \
    "SELECT subject_id, hadm_id, stay_id, charttime::text, medication, route, action, status, dose, dose_unit, data_origin FROM mimic_final.emar WHERE $IP_FILTER"

copy_table "chartevents" \
    "SELECT subject_id, hadm_id, stay_id, charttime::text, itemid, label, value, valuenum, valueuom, data_origin FROM mimic_final.chartevents WHERE $IP_FILTER"

copy_table "problem_list" \
    "SELECT subject_id, hadm_id, problem_id, dx_id, icd9_code, diagnosis_code, current_icd10_list, diagnosis_name, starttime::text, endtime::text, status, chronic_yn, data_origin FROM mimic_final.problem_list WHERE $IP_FILTER"

copy_table "d_labitems" \
    "SELECT itemid, label, fluid, category FROM mimic_final.d_labitems"

copy_table "d_items" \
    "SELECT itemid, label, abbreviation, linksto, category, unitname, param_type, lownormalvalue, highnormalvalue FROM mimic_final.d_items"

echo ""
echo "Creating indexes..."
dst -c "
CREATE INDEX IF NOT EXISTS idx_ah_pat_sid ON ${SCHEMA}.patients (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_adm_sid ON ${SCHEMA}.admissions (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_adm_hid ON ${SCHEMA}.admissions (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_xfr_sid ON ${SCHEMA}.transfers (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_xfr_hid ON ${SCHEMA}.transfers (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_icu_sid ON ${SCHEMA}.icustays (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_dx_sid ON ${SCHEMA}.diagnoses_icd (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_dx_hid ON ${SCHEMA}.diagnoses_icd (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_rx_sid ON ${SCHEMA}.prescriptions (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_rx_hid ON ${SCHEMA}.prescriptions (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_svc_sid ON ${SCHEMA}.services (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_lab_sid ON ${SCHEMA}.labevents (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_lab_hid ON ${SCHEMA}.labevents (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_emar_sid ON ${SCHEMA}.emar (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_chart_sid ON ${SCHEMA}.chartevents (subject_id);
CREATE INDEX IF NOT EXISTS idx_ah_chart_hid ON ${SCHEMA}.chartevents (hadm_id);
CREATE INDEX IF NOT EXISTS idx_ah_pl_sid ON ${SCHEMA}.problem_list (subject_id);
" 2>/dev/null
echo "Indexes created"

echo ""
echo "Registering in Morpheus dataset registry..."
dst -c "
INSERT INTO inpatient_ext.morpheus_dataset (name, schema_name, description, source_type, patient_count, status)
VALUES ('AtlanticHealth', 'atlantic_health', 'AtlanticHealth inpatient dataset — 243K patients from Epic EHR (observed + synthetic augmentation)', 'Epic', (SELECT count(*) FROM ${SCHEMA}.patients), 'active')
ON CONFLICT (schema_name) DO UPDATE SET
    patient_count = EXCLUDED.patient_count,
    description = EXCLUDED.description;
" 2>/dev/null
echo "Registered as Morpheus dataset"

echo ""
echo "=== Verification ==="
dst -c "
SELECT relname as table_name, n_live_tup as approx_rows
FROM pg_stat_user_tables
WHERE schemaname = '${SCHEMA}'
ORDER BY relname;" 2>/dev/null

echo ""
echo "=== Morpheus Datasets ==="
dst -c "SELECT name, schema_name, patient_count, status FROM inpatient_ext.morpheus_dataset ORDER BY name;" 2>/dev/null

echo ""
echo "=== Copy complete ==="
