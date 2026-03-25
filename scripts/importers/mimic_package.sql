create schema if not exists mimic_final;

drop table if exists mimic_final.dataset_catalog cascade;
create table mimic_final.dataset_catalog (
    object_name text primary key,
    object_type text not null,
    source_schema text not null,
    provenance text not null,
    row_count bigint,
    notes text
);

insert into mimic_final.dataset_catalog (object_name, object_type, source_schema, provenance, row_count, notes)
select
    object_name,
    object_type,
    'mimic_export'::text as source_schema,
    'observed'::text as provenance,
    row_count,
    notes
from mimic_export.dataset_metadata
union all
select
    object_name,
    'table'::text as object_type,
    'mimic_synth'::text as source_schema,
    'synthetic'::text as provenance,
    row_count,
    notes
from mimic_synth.dataset_metadata;

create or replace view mimic_final.patients as
select
    mp.subject_id,
    mp.gender,
    mp.dob,
    mp.dod,
    mp.language,
    mp.marital_status,
    mp.race,
    mp.src_pat_id,
    mp.src_epic_pat_id,
    mp.mrn,
    'observed'::text as data_origin
from mimic_export.mimic_patients mp;

create or replace view mimic_final.admissions as
select
    ma.subject_id,
    ma.hadm_id,
    ma.admittime,
    ma.dischtime,
    ma.deathtime,
    ma.admission_type,
    ma.admission_location,
    ma.discharge_location,
    ma.language,
    ma.marital_status,
    ma.race,
    ma.edregtime,
    ma.edouttime,
    ma.hospital_expire_flag,
    ma.src_pat_id,
    ma.src_pat_enc_csn_id,
    ma.src_hsp_account_id,
    'observed'::text as data_origin
from mimic_export.mimic_admissions ma;

create or replace view mimic_final.transfers as
select
    mt.subject_id,
    mt.hadm_id,
    mt.transfer_id,
    mt.eventtime as intime,
    null::timestamp as outtime,
    mt.patient_class as careunit,
    mt.department_id,
    mt.loc_id,
    mt.room_id,
    mt.bed_id,
    mt.event_type_c,
    mt.int_event_type_c,
    mt.src_event_id,
    mt.src_pat_enc_csn_id,
    'observed'::text as data_origin
from mimic_export.mimic_transfers mt;

create or replace view mimic_final.orders as
select
    mo.subject_id,
    mo.hadm_id,
    mo.order_id,
    mo.ordertime,
    mo.resulttime,
    mo.order_name,
    mo.med_name,
    mo.proc_id,
    mo.order_type_c,
    mo.cpoe_order_type_c,
    mo.dose,
    mo.order_status_c,
    mo.lab_status_c,
    mo.resulting_lab_id,
    mo.resulting_prov,
    mo.is_medication_order,
    mo.is_lab_order,
    mo.source_table,
    mo.src_order_proc_id,
    mo.src_cpoe_order_id,
    mo.src_pat_enc_csn_id,
    'observed'::text as data_origin
from mimic_export.mimic_orders mo;

create or replace view mimic_final.problem_list as
select
    mp.subject_id,
    mp.hadm_id,
    mp.problem_id,
    mp.dx_id,
    mp.icd9_code,
    mp.diagnosis_code,
    mp.current_icd10_list,
    mp.diagnosis_name,
    mp.starttime,
    mp.endtime,
    mp.status,
    mp.problem_status_c,
    mp.class_of_problem,
    mp.problem_type_c,
    mp.chronic_yn,
    mp.is_present_on_adm_c,
    mp.diagnosis_provenance,
    mp.src_problem_list_id,
    'observed'::text as data_origin
from mimic_export.mimic_problem_list mp;

create or replace view mimic_final.labevents as
select
    sl.subject_id,
    sl.hadm_id,
    null::bigint as stay_id,
    sl.charttime,
    sl.itemid,
    sl.label,
    sl.value,
    sl.valuenum,
    sl.valueuom,
    sl.flag,
    sl.specimen,
    sl.source_order_id,
    sl.source_order_name,
    sl.generation_model,
    sl.generation_version,
    sl.data_origin
from mimic_synth.synthetic_labevents sl;

create or replace view mimic_final.emar as
select
    se.subject_id,
    se.hadm_id,
    null::bigint as stay_id,
    se.charttime,
    se.medication,
    se.route,
    se.action,
    se.status,
    se.dose,
    se.dose_unit,
    se.source_order_id,
    se.source_med_name,
    se.generation_model,
    se.generation_version,
    se.data_origin
from mimic_synth.synthetic_emar se;

create or replace view mimic_final.chartevents as
select
    sc.subject_id,
    sc.hadm_id,
    null::bigint as stay_id,
    sc.charttime,
    sc.itemid,
    sc.label,
    sc.value,
    sc.valuenum,
    sc.valueuom,
    sc.generation_model,
    sc.generation_version,
    sc.data_origin
from mimic_synth.synthetic_chartevents sc;
