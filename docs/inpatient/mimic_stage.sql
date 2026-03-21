create schema if not exists mimic_stage;

create or replace function mimic_stage.text_to_timestamp(txt text)
returns timestamp
language sql
immutable
as $$
    select case
        when txt is null or btrim(txt) = '' or btrim(txt) ~ E'^\\\\+N$' then null
        else txt::timestamp
    end
$$;

create or replace function mimic_stage.stable_id(txt text)
returns bigint
language sql
immutable
as $$
    select case
        when txt is null or btrim(txt) = '' or btrim(txt) ~ E'^\\\\+N$' then null
        else abs(('x' || substr(md5(txt), 1, 16))::bit(64)::bigint)
    end
$$;

create or replace view mimic_stage.mimic_patients as
select
    mimic_stage.stable_id(p.pat_id) as subject_id,
    p.pat_id as src_pat_id,
    p.epic_pat_id as src_epic_pat_id,
    p.pat_mrn_id as mrn,
    coalesce(nullif(p.sex, '\N'), zs.title, zs.name) as gender,
    mimic_stage.text_to_timestamp(p.birth_date)::date as dob,
    mimic_stage.text_to_timestamp(p.death_date) as dod,
    coalesce(nullif(zl.title, '\N'), zl.name, p.language_c) as language,
    coalesce(nullif(zm.title, '\N'), zm.name, p.marital_status_c) as marital_status,
    coalesce(nullif(ze.title, '\N'), ze.name, p.ethnic_group_c) as race,
    p.city,
    p.state_c,
    p.zip,
    p.record_state_c
from stage.patient p
left join stage.zc_sex zs on zs.rcpt_mem_sex_c = p.sex_c
left join stage.zc_language zl on zl.language_c = p.language_c
left join stage.zc_marital_status zm on zm.marital_status_c = p.marital_status_c
left join stage.zc_ethnic_group ze on ze.ethnic_group_c = p.ethnic_group_c;

create or replace view mimic_stage.mimic_admissions as
with hx as (
    select
        h.pat_id,
        h.pat_enc_csn_id,
        h.hsp_account_id,
        mimic_stage.text_to_timestamp(h.hosp_admsn_time) as admittime,
        mimic_stage.text_to_timestamp(h.hosp_disch_time) as dischtime,
        mimic_stage.text_to_timestamp(h.adt_arrival_time) as edregtime,
        mimic_stage.text_to_timestamp(h.ed_departure_time) as edouttime,
        h.admit_source_c,
        h.adt_pat_class_c,
        h.disch_disp_c,
        h.disch_dest_c,
        h.admission_prov_id,
        h.discharge_prov_id
    from stage.pat_enc_hsp_hx h
)
select
    mimic_stage.stable_id(hx.pat_id) as subject_id,
    mimic_stage.stable_id(hx.hsp_account_id) as hadm_id,
    hx.pat_id as src_pat_id,
    hx.pat_enc_csn_id as src_pat_enc_csn_id,
    hx.hsp_account_id as src_hsp_account_id,
    hx.admittime,
    hx.dischtime,
    case
        when mp.dod is not null and hx.admittime is not null and hx.dischtime is not null
            and mp.dod >= hx.admittime and mp.dod <= hx.dischtime
        then mp.dod
        else null
    end as deathtime,
    coalesce(nullif(zpc.title, '\N'), zpc.name, hx.adt_pat_class_c) as admission_type,
    coalesce(nullif(zas.title, '\N'), zas.name, hx.admit_source_c) as admission_location,
    trim(both ' ' from concat_ws(' / ',
        coalesce(nullif(zdd.title, '\N'), zdd.name, hx.disch_disp_c),
        coalesce(nullif(zdst.title, '\N'), zdst.name, hx.disch_dest_c)
    )) as discharge_location,
    mp.language,
    mp.marital_status,
    mp.race,
    hx.edregtime,
    hx.edouttime,
    case
        when mp.dod is not null and hx.admittime is not null and hx.dischtime is not null
            and mp.dod >= hx.admittime and mp.dod <= hx.dischtime
        then 1
        else 0
    end as hospital_expire_flag,
    hx.admission_prov_id,
    hx.discharge_prov_id
from hx
left join mimic_stage.mimic_patients mp on mp.src_pat_id = hx.pat_id
left join stage.zc_adm_source zas on zas.admit_source_c = hx.admit_source_c
left join stage.zc_pat_class zpc on zpc.adt_pat_class_c = hx.adt_pat_class_c
left join stage.zc_disch_disp zdd on zdd.disch_disp_c = hx.disch_disp_c
left join stage.zc_disch_dest zdst on zdst.disch_dest_c = hx.disch_dest_c;

create or replace view mimic_stage.mimic_transfers as
select
    mimic_stage.stable_id(t.pat_id) as subject_id,
    mimic_stage.stable_id(hx.hsp_account_id) as hadm_id,
    mimic_stage.stable_id(t.event_id) as transfer_id,
    t.event_id as src_event_id,
    t.pat_id as src_pat_id,
    t.pat_enc_csn_id as src_pat_enc_csn_id,
    hx.hsp_account_id as src_hsp_account_id,
    mimic_stage.text_to_timestamp(t.entry_utc_time) as eventtime,
    mimic_stage.text_to_timestamp(t.effective_time) as intime,
    t.event_type_c,
    t.int_event_type_c,
    t.department_id,
    t.loc_id,
    t.room_id,
    t.bed_id,
    t.serv_area_id,
    coalesce(nullif(zpc.title, '\N'), zpc.name, t.pat_class_c) as patient_class,
    t.pat_service_c,
    t.pat_lvl_of_care_c,
    t.accommodation_c,
    t.comments
from stage.adt_transfers t
left join stage.pat_enc_hsp_hx hx on hx.pat_enc_csn_id = t.pat_enc_csn_id
left join stage.zc_pat_class zpc on zpc.adt_pat_class_c = t.pat_class_c;

create or replace view mimic_stage.mimic_orders as
with order_proc_base as (
    select
        mimic_stage.stable_id(op.pat_id) as subject_id,
        mimic_stage.stable_id(hx.hsp_account_id) as hadm_id,
        mimic_stage.stable_id(coalesce(op.order_proc_id, c.order_id)) as order_id,
        op.order_proc_id as src_order_proc_id,
        c.order_id as src_cpoe_order_id,
        op.pat_id as src_pat_id,
        op.pat_enc_csn_id as src_pat_enc_csn_id,
        hx.hsp_account_id as src_hsp_account_id,
        coalesce(
            mimic_stage.text_to_timestamp(op.order_time),
            mimic_stage.text_to_timestamp(c.order_dttm),
            mimic_stage.text_to_timestamp(op.ordering_date)
        ) as ordertime,
        coalesce(
            mimic_stage.text_to_timestamp(os.result_dttm),
            mimic_stage.text_to_timestamp(op.result_time)
        ) as resulttime,
        op.order_type_c,
        c.order_type_c as cpoe_order_type_c,
        op.proc_id,
        coalesce(nullif(op.display_name, '\N'), nullif(op.description, '\N'), c.proc_name) as order_name,
        c.medication_id,
        c.med_name,
        op.dose,
        op.order_status_c,
        op.lab_status_c,
        os.resulting_lab_id,
        os.resulting_prov,
        coalesce(
            (c.medication_id is not null or nullif(c.med_name, '\N') is not null),
            false
        ) as is_medication_order,
        (op.result_lab_id is not null or os.resulting_lab_id is not null) as is_lab_order,
        'order_proc'::text as source_table
    from stage.order_proc op
    left join stage.cpoe_info c on c.order_id = op.order_proc_id
    left join stage.order_status os on os.order_id = op.order_proc_id
    left join stage.pat_enc_hsp_hx hx on hx.pat_enc_csn_id = op.pat_enc_csn_id
),
cpoe_only as (
    select
        mimic_stage.stable_id(c.pat_id) as subject_id,
        mimic_stage.stable_id(hx.hsp_account_id) as hadm_id,
        mimic_stage.stable_id(c.order_id) as order_id,
        null::text as src_order_proc_id,
        c.order_id as src_cpoe_order_id,
        c.pat_id as src_pat_id,
        c.pat_enc_csn_id as src_pat_enc_csn_id,
        hx.hsp_account_id as src_hsp_account_id,
        mimic_stage.text_to_timestamp(c.order_dttm) as ordertime,
        null::timestamp as resulttime,
        null::text as order_type_c,
        c.order_type_c as cpoe_order_type_c,
        c.proc_id,
        c.proc_name as order_name,
        c.medication_id,
        c.med_name,
        null::text as dose,
        null::text as order_status_c,
        null::text as lab_status_c,
        null::text as resulting_lab_id,
        null::text as resulting_prov,
        (c.medication_id is not null or nullif(c.med_name, '\N') is not null) as is_medication_order,
        false as is_lab_order,
        'cpoe_info'::text as source_table
    from stage.cpoe_info c
    left join stage.order_proc op on op.order_proc_id = c.order_id
    left join stage.pat_enc_hsp_hx hx on hx.pat_enc_csn_id = c.pat_enc_csn_id
    where op.order_proc_id is null
)
select * from order_proc_base
union all
select * from cpoe_only;

create or replace view mimic_stage.mimic_problem_list as
select
    mimic_stage.stable_id(pl.pat_id) as subject_id,
    mimic_stage.stable_id(hx.hsp_account_id) as hadm_id,
    mimic_stage.stable_id(pl.problem_list_id) as problem_id,
    pl.problem_list_id as src_problem_list_id,
    pl.pat_id as src_pat_id,
    pl.problem_ept_csn as src_pat_enc_csn_id,
    hx.hsp_account_id as src_hsp_account_id,
    pl.dx_id,
    coalesce(nullif(pl.icd9_code, '\N'), nullif(ce.icd9_code, '\N')) as icd9_code,
    ce.diagnosis_code,
    ce.current_icd10_list,
    coalesce(nullif(pl.description, '\N'), nullif(ce.pat_friendly_text, '\N'), ce.dx_other_desc) as diagnosis_name,
    mimic_stage.text_to_timestamp(pl.date_of_entry) as starttime,
    coalesce(
        mimic_stage.text_to_timestamp(pl.resolved_date),
        mimic_stage.text_to_timestamp(pl.diag_end_date),
        mimic_stage.text_to_timestamp(pl.noted_end_date)
    ) as endtime,
    pl.status,
    pl.problem_status_c,
    pl.class_of_problem,
    pl.problem_type_c,
    pl.chronic_yn,
    pl.is_present_on_adm_c,
    case
        when hx.hsp_account_id is null then 'patient_problem_list'
        else 'encounter_linked_problem_list'
    end as diagnosis_provenance
from stage.problem_list pl
left join stage.clarity_edg ce on ce.dx_imo_id = pl.dx_id
left join stage.pat_enc_hsp_hx hx on hx.pat_enc_csn_id = pl.problem_ept_csn;
