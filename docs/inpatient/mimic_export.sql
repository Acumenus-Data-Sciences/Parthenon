create schema if not exists mimic_export;

drop table if exists mimic_export.mimic_patients cascade;
create unlogged table mimic_export.mimic_patients as
select * from mimic_stage.mimic_patients;

create index if not exists mimic_patients_subject_id_idx
    on mimic_export.mimic_patients (subject_id);
create index if not exists mimic_patients_src_pat_id_idx
    on mimic_export.mimic_patients (src_pat_id);

drop table if exists mimic_export.mimic_admissions cascade;
create unlogged table mimic_export.mimic_admissions as
select * from mimic_stage.mimic_admissions;

create index if not exists mimic_admissions_hadm_id_idx
    on mimic_export.mimic_admissions (hadm_id);
create index if not exists mimic_admissions_subject_id_idx
    on mimic_export.mimic_admissions (subject_id);
create index if not exists mimic_admissions_src_pat_enc_csn_id_idx
    on mimic_export.mimic_admissions (src_pat_enc_csn_id);
create index if not exists mimic_admissions_src_hsp_account_id_idx
    on mimic_export.mimic_admissions (src_hsp_account_id);

drop table if exists mimic_export.mimic_transfers cascade;
create unlogged table mimic_export.mimic_transfers as
select * from mimic_stage.mimic_transfers;

create index if not exists mimic_transfers_transfer_id_idx
    on mimic_export.mimic_transfers (transfer_id);
create index if not exists mimic_transfers_hadm_id_idx
    on mimic_export.mimic_transfers (hadm_id);
create index if not exists mimic_transfers_subject_id_idx
    on mimic_export.mimic_transfers (subject_id);
create index if not exists mimic_transfers_src_pat_enc_csn_id_idx
    on mimic_export.mimic_transfers (src_pat_enc_csn_id);

drop table if exists mimic_export.mimic_orders cascade;
create unlogged table mimic_export.mimic_orders as
select * from mimic_stage.mimic_orders;

create index if not exists mimic_orders_order_id_idx
    on mimic_export.mimic_orders (order_id);
create index if not exists mimic_orders_hadm_id_idx
    on mimic_export.mimic_orders (hadm_id);
create index if not exists mimic_orders_subject_id_idx
    on mimic_export.mimic_orders (subject_id);
create index if not exists mimic_orders_src_pat_enc_csn_id_idx
    on mimic_export.mimic_orders (src_pat_enc_csn_id);
create index if not exists mimic_orders_ordertime_idx
    on mimic_export.mimic_orders (ordertime);

drop table if exists mimic_export.mimic_problem_list cascade;
create unlogged table mimic_export.mimic_problem_list as
select * from mimic_stage.mimic_problem_list;

create index if not exists mimic_problem_list_problem_id_idx
    on mimic_export.mimic_problem_list (problem_id);
create index if not exists mimic_problem_list_subject_id_idx
    on mimic_export.mimic_problem_list (subject_id);
create index if not exists mimic_problem_list_hadm_id_idx
    on mimic_export.mimic_problem_list (hadm_id);

drop table if exists mimic_export.dataset_metadata cascade;
create table mimic_export.dataset_metadata (
    object_name text primary key,
    object_type text not null,
    row_count bigint,
    notes text
);

insert into mimic_export.dataset_metadata (object_name, object_type, row_count, notes)
select 'mimic_patients', 'table', count(*), 'Observed patient-level demographics derived from stage.patient'
from mimic_export.mimic_patients
union all
select 'mimic_admissions', 'table', count(*), 'Observed hospital encounters derived from pat_enc_hsp_hx; hadm_id null when src_hsp_account_id is sentinel \\N'
from mimic_export.mimic_admissions
union all
select 'mimic_transfers', 'table', count(*), 'Observed ADT transfer events derived from adt_transfers; some rows do not resolve to hadm_id'
from mimic_export.mimic_transfers
union all
select 'mimic_orders', 'table', count(*), 'Observed order-level data derived from order_proc plus cpoe_info; not equivalent to labevents or emar'
from mimic_export.mimic_orders
union all
select 'mimic_problem_list', 'table', count(*), 'Observed patient problem list; not encounter-linked in this source extract'
from mimic_export.mimic_problem_list;
