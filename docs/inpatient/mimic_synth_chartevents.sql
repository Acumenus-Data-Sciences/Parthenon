create schema if not exists mimic_synth;

create or replace function mimic_synth.text_to_numeric(txt text)
returns numeric
language sql
immutable
as $$
    select case
        when txt is null or btrim(txt) = '' or btrim(txt) ~ E'^\\\\+N$' then null
        else txt::numeric
    end
$$;

drop table if exists mimic_synth.synthetic_chartevents cascade;

create unlogged table mimic_synth.synthetic_chartevents as
with inpatient_admissions as (
    select
        a.subject_id,
        a.hadm_id,
        a.src_pat_enc_csn_id,
        a.admittime,
        coalesce(a.dischtime, a.admittime + interval '2 days') as dischtime,
        a.hospital_expire_flag,
        mimic_synth.text_to_numeric(pe.bp_systolic::text) as bp_systolic,
        mimic_synth.text_to_numeric(pe.bp_diastolic::text) as bp_diastolic,
        mimic_synth.text_to_numeric(pe.temperature::text) as temperature,
        mimic_synth.text_to_numeric(pe.pulse::text) as pulse,
        mimic_synth.text_to_numeric(pe.respirations::text) as respirations
    from mimic_export.mimic_admissions a
    left join stage.pat_enc pe
      on pe.pat_enc_csn_id = a.src_pat_enc_csn_id
    where a.hadm_id is not null
      and a.admittime is not null
      and coalesce(a.dischtime, a.admittime) >= a.admittime
), transfer_summary as (
    select
        hadm_id,
        max(case when patient_class = 'INPATIENT' then 1 else 0 end) as seen_inpatient,
        max(case when patient_class = 'EMERGENCY' then 1 else 0 end) as seen_ed,
        max(case when patient_class = 'OBSERVATION' then 1 else 0 end) as seen_observation
    from mimic_export.mimic_transfers
    where hadm_id is not null
    group by hadm_id
), eligible as (
    select
        ia.subject_id,
        ia.hadm_id,
        ia.src_pat_enc_csn_id,
        ia.admittime,
        ia.dischtime,
        ia.hospital_expire_flag,
        greatest(4, least(48, floor(extract(epoch from (ia.dischtime - ia.admittime)) / 21600.0)::int + 1)) as n_points,
        coalesce(ia.bp_systolic,
            case
                when ts.seen_inpatient = 1 then 122
                when ts.seen_ed = 1 then 128
                when ts.seen_observation = 1 then 124
                else 123
            end
        ) as base_sbp,
        coalesce(ia.bp_diastolic,
            case
                when ts.seen_inpatient = 1 then 72
                when ts.seen_ed = 1 then 76
                when ts.seen_observation = 1 then 74
                else 74
            end
        ) as base_dbp,
        coalesce(ia.temperature,
            case
                when ia.hospital_expire_flag = 1 then 99.3
                else 98.6
            end
        ) as base_temp_f,
        coalesce(ia.pulse,
            case
                when ia.hospital_expire_flag = 1 then 96
                when ts.seen_ed = 1 then 90
                else 84
            end
        ) as base_hr,
        coalesce(ia.respirations,
            case
                when ia.hospital_expire_flag = 1 then 20
                else 17
            end
        ) as base_rr,
        case
            when ia.hospital_expire_flag = 1 then 94::numeric
            else 97::numeric
        end as base_spo2
    from inpatient_admissions ia
    left join transfer_summary ts
      on ts.hadm_id = ia.hadm_id
), expanded as (
    select
        e.*,
        gs.seq_no
    from eligible e
    cross join lateral generate_series(1, e.n_points) as gs(seq_no)
), timed as (
    select
        ex.*,
        least(
            ex.dischtime,
            ex.admittime + make_interval(
                mins => floor(
                    (extract(epoch from greatest(interval '1 hour', ex.dischtime - ex.admittime)) / 60.0)
                    * (ex.seq_no::double precision / (ex.n_points + 1)::double precision)
                    + 20 * mimic_synth.stable_uniform(ex.hadm_id::text || ex.seq_no, 'chart_jitter')
                )::int
            )
        ) as charttime
    from expanded ex
), vitals as (
    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        220045::bigint as itemid,
        'Heart Rate'::text as label,
        greatest(45::numeric, least(170::numeric,
            t.base_hr
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'hr1') - 0.5) * 18
            + case when t.seq_no = t.n_points and t.base_hr > 90 then 6 else 0 end
        )) as valuenum,
        'bpm'::text as valueuom
    from timed t

    union all

    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        220179::bigint,
        'Systolic Blood Pressure',
        greatest(70::numeric, least(210::numeric,
            t.base_sbp
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'sbp1') - 0.5) * 22
            + case when t.seq_no = t.n_points and t.base_sbp < 100 then -5 else 0 end
        )),
        'mmHg'
    from timed t

    union all

    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        220180::bigint,
        'Diastolic Blood Pressure',
        greatest(35::numeric, least(120::numeric,
            t.base_dbp
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'dbp1') - 0.5) * 14
        )),
        'mmHg'
    from timed t

    union all

    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        223761::bigint,
        'Temperature Fahrenheit',
        greatest(95.0::numeric, least(104.5::numeric,
            t.base_temp_f
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'temp1') - 0.5) * 1.8
            + case when t.seq_no = 1 and mimic_synth.stable_uniform(t.hadm_id::text, 'temp_spike') < 0.08 then 1.8 else 0 end
        )),
        'F'
    from timed t

    union all

    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        220210::bigint,
        'Respiratory Rate',
        greatest(8::numeric, least(40::numeric,
            t.base_rr
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'rr1') - 0.5) * 6
            + case when t.seq_no = t.n_points and t.base_rr > 18 then 2 else 0 end
        )),
        'insp/min'
    from timed t

    union all

    select
        t.subject_id,
        t.hadm_id,
        t.charttime,
        220277::bigint,
        'O2 Saturation Pulseoxymetry',
        greatest(84::numeric, least(100::numeric,
            t.base_spo2
            + (mimic_synth.stable_uniform(t.hadm_id::text || t.seq_no, 'spo21') - 0.5) * 4
            - case when t.hospital_expire_flag = 1 then 1.5 else 0 end
        )),
        '%'
    from timed t
)
select
    v.subject_id,
    v.hadm_id,
    v.charttime,
    v.itemid,
    v.label,
    round(v.valuenum::numeric, 1) as valuenum,
    round(v.valuenum::numeric, 1)::text as value,
    v.valueuom,
    'empirical_sql_generator'::text as generation_model,
    'v1'::text as generation_version,
    'synthetic'::text as data_origin
from vitals v;

create index if not exists synthetic_chartevents_hadm_id_idx
    on mimic_synth.synthetic_chartevents (hadm_id);
create index if not exists synthetic_chartevents_subject_id_idx
    on mimic_synth.synthetic_chartevents (subject_id);
create index if not exists synthetic_chartevents_charttime_idx
    on mimic_synth.synthetic_chartevents (charttime);
create index if not exists synthetic_chartevents_itemid_idx
    on mimic_synth.synthetic_chartevents (itemid);

create table if not exists mimic_synth.dataset_metadata (
    object_name text primary key,
    row_count bigint,
    notes text
);

insert into mimic_synth.dataset_metadata (object_name, row_count, notes)
select
    'synthetic_chartevents',
    count(*),
    'Deterministic synthetic vital-sign chart events generated from observed admissions plus transfer context; provenance is synthetic'
from mimic_synth.synthetic_chartevents
on conflict (object_name) do update
set row_count = excluded.row_count,
    notes = excluded.notes;
