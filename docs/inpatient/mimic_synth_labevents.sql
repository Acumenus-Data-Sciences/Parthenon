create schema if not exists mimic_synth;

create or replace function mimic_synth.stable_uniform(txt text, salt text default '')
returns double precision
language sql
immutable
as $$
    select (
        ('x' || substr(md5(coalesce(txt, '') || '|' || coalesce(salt, '')), 1, 8))::bit(32)::bigint
    )::double precision / 4294967295.0
$$;

drop table if exists mimic_synth.synthetic_labevents cascade;

create unlogged table mimic_synth.synthetic_labevents as
with eligible_orders as (
    select
        o.subject_id,
        o.hadm_id,
        o.order_id as source_order_id,
        o.order_name as source_order_name,
        upper(o.order_name) as order_name_upper,
        o.ordertime,
        o.resulttime,
        a.admittime,
        a.dischtime,
        p.gender
    from mimic_export.mimic_orders o
    join mimic_export.mimic_admissions a
      on a.hadm_id = o.hadm_id
    left join mimic_export.mimic_patients p
      on p.subject_id = o.subject_id
    where o.hadm_id is not null
      and o.is_lab_order
      and o.order_name is not null
      and o.order_name <> '\N'
), classified_orders as (
    select
        eo.*,
        case
            when eo.order_name_upper like '%COMPREHENSIVE METABOLIC PANEL%' then 'CMP'
            when eo.order_name_upper like '%BASIC METABOLIC PANEL%' then 'BMP'
            when eo.order_name_upper like '%CBC AUTO DIFFERENTIAL%' then 'CBC_DIFF'
            when eo.order_name_upper like '%CBC WITH DIFFERENTIAL%' then 'CBC_DIFF'
            when eo.order_name_upper like '%CBC AND DIFFERENTIAL%' then 'CBC_DIFF'
            when eo.order_name_upper = 'CBC' then 'CBC'
            when eo.order_name_upper like '%MAGNESIUM%' then 'MAGNESIUM'
            when eo.order_name_upper like '%PHOSPHORUS%' then 'PHOSPHORUS'
            when eo.order_name_upper like '%HEPATIC FUNCTION PANEL%' then 'HEPATIC'
            when eo.order_name_upper like '%POCT GLUCOSE%' then 'GLUCOSE'
            when eo.order_name_upper like '%STAT-STRIP GLUCOMETER%' then 'GLUCOSE'
            when eo.order_name_upper like '%FINGERSTICK GLUCOSE%' then 'GLUCOSE'
            when eo.order_name_upper like '%PROTIME-INR%' then 'PTINR'
            when eo.order_name_upper = 'APTT' then 'APTT'
            when eo.order_name_upper like 'APTT (%' then 'APTT'
            when eo.order_name_upper like '%TROPONIN T HS%' then 'TROPONIN'
            when eo.order_name_upper like '%LIPASE%' then 'LIPASE'
            when eo.order_name_upper like '%URINALYSIS WITH CULTURE IF INDICATED%' then 'UA'
            when eo.order_name_upper like '%UA MICROSCOPIC EXAM%' then 'UA_MICRO'
            else null
        end as lab_family
    from eligible_orders eo
), family_components as (
    select * from (
        values
            ('BMP', 900001, 'Sodium', 136::numeric, 145::numeric, 128::numeric, 154::numeric, 'mEq/L', 'Blood', 0),
            ('BMP', 900002, 'Potassium', 3.5, 5.1, 2.7, 6.2, 'mEq/L', 'Blood', 1),
            ('BMP', 900003, 'Chloride', 98, 107, 90, 116, 'mEq/L', 'Blood', 0),
            ('BMP', 900004, 'Bicarbonate', 22, 29, 14, 38, 'mEq/L', 'Blood', 0),
            ('BMP', 900005, 'BUN', 7, 25, 3, 80, 'mg/dL', 'Blood', 0),
            ('BMP', 900006, 'Creatinine', 0.6, 1.3, 0.3, 6.0, 'mg/dL', 'Blood', 2),
            ('BMP', 900007, 'Glucose', 70, 110, 45, 320, 'mg/dL', 'Blood', 0),
            ('BMP', 900008, 'Calcium', 8.5, 10.5, 7.0, 12.5, 'mg/dL', 'Blood', 1),
            ('CMP', 900001, 'Sodium', 136, 145, 128, 154, 'mEq/L', 'Blood', 0),
            ('CMP', 900002, 'Potassium', 3.5, 5.1, 2.7, 6.2, 'mEq/L', 'Blood', 1),
            ('CMP', 900003, 'Chloride', 98, 107, 90, 116, 'mEq/L', 'Blood', 0),
            ('CMP', 900004, 'Bicarbonate', 22, 29, 14, 38, 'mEq/L', 'Blood', 0),
            ('CMP', 900005, 'BUN', 7, 25, 3, 80, 'mg/dL', 'Blood', 0),
            ('CMP', 900006, 'Creatinine', 0.6, 1.3, 0.3, 6.0, 'mg/dL', 'Blood', 2),
            ('CMP', 900007, 'Glucose', 70, 110, 45, 320, 'mg/dL', 'Blood', 0),
            ('CMP', 900008, 'Calcium', 8.5, 10.5, 7.0, 12.5, 'mg/dL', 'Blood', 1),
            ('CMP', 900009, 'Total Protein', 6.2, 8.3, 4.5, 9.8, 'g/dL', 'Blood', 1),
            ('CMP', 900010, 'Albumin', 3.5, 5.0, 2.0, 5.8, 'g/dL', 'Blood', 1),
            ('CMP', 900011, 'Total Bilirubin', 0.2, 1.2, 0.1, 8.0, 'mg/dL', 'Blood', 1),
            ('CMP', 900012, 'AST', 10, 40, 5, 350, 'U/L', 'Blood', 0),
            ('CMP', 900013, 'ALT', 7, 56, 4, 400, 'U/L', 'Blood', 0),
            ('CMP', 900014, 'Alkaline Phosphatase', 40, 130, 20, 450, 'U/L', 'Blood', 0),
            ('CBC_DIFF', 900101, 'WBC', 4.0, 11.0, 1.0, 30.0, 'K/uL', 'Blood', 1),
            ('CBC_DIFF', 900102, 'Hemoglobin', 11.5, 16.5, 6.0, 20.0, 'g/dL', 'Blood', 1),
            ('CBC_DIFF', 900103, 'Hematocrit', 35.0, 49.0, 18.0, 60.0, '%', 'Blood', 1),
            ('CBC_DIFF', 900104, 'Platelets', 150, 400, 20, 900, 'K/uL', 'Blood', 0),
            ('CBC', 900101, 'WBC', 4.0, 11.0, 1.0, 30.0, 'K/uL', 'Blood', 1),
            ('CBC', 900102, 'Hemoglobin', 11.5, 16.5, 6.0, 20.0, 'g/dL', 'Blood', 1),
            ('CBC', 900103, 'Hematocrit', 35.0, 49.0, 18.0, 60.0, '%', 'Blood', 1),
            ('CBC', 900104, 'Platelets', 150, 400, 20, 900, 'K/uL', 'Blood', 0),
            ('MAGNESIUM', 900201, 'Magnesium', 1.7, 2.4, 1.0, 4.0, 'mg/dL', 'Blood', 1),
            ('PHOSPHORUS', 900202, 'Phosphate', 2.5, 4.8, 1.0, 8.0, 'mg/dL', 'Blood', 1),
            ('HEPATIC', 900009, 'Total Protein', 6.2, 8.3, 4.5, 9.8, 'g/dL', 'Blood', 1),
            ('HEPATIC', 900010, 'Albumin', 3.5, 5.0, 2.0, 5.8, 'g/dL', 'Blood', 1),
            ('HEPATIC', 900011, 'Total Bilirubin', 0.2, 1.2, 0.1, 8.0, 'mg/dL', 'Blood', 1),
            ('HEPATIC', 900012, 'AST', 10, 40, 5, 350, 'U/L', 'Blood', 0),
            ('HEPATIC', 900013, 'ALT', 7, 56, 4, 400, 'U/L', 'Blood', 0),
            ('HEPATIC', 900014, 'Alkaline Phosphatase', 40, 130, 20, 450, 'U/L', 'Blood', 0),
            ('GLUCOSE', 900301, 'Glucose', 70, 140, 45, 380, 'mg/dL', 'Blood', 0),
            ('PTINR', 900401, 'PT', 11.0, 13.5, 9.0, 35.0, 'sec', 'Blood', 1),
            ('PTINR', 900402, 'INR', 0.8, 1.2, 0.7, 4.5, 'ratio', 'Blood', 2),
            ('APTT', 900403, 'aPTT', 25.0, 36.0, 18.0, 150.0, 'sec', 'Blood', 1),
            ('TROPONIN', 900501, 'Troponin T hs', 0.0, 14.0, 0.0, 500.0, 'ng/L', 'Blood', 1),
            ('LIPASE', 900502, 'Lipase', 13.0, 60.0, 5.0, 600.0, 'U/L', 'Blood', 0),
            ('UA', 900601, 'Urine Specific Gravity', 1.005, 1.030, 1.001, 1.040, 'ratio', 'Urine', 3),
            ('UA', 900602, 'Urine pH', 5.0, 8.0, 4.5, 9.0, 'pH', 'Urine', 1),
            ('UA', 900603, 'Urine WBC', 0.0, 5.0, 0.0, 50.0, '/HPF', 'Urine', 0),
            ('UA', 900604, 'Urine RBC', 0.0, 2.0, 0.0, 50.0, '/HPF', 'Urine', 0),
            ('UA_MICRO', 900603, 'Urine WBC', 0.0, 5.0, 0.0, 50.0, '/HPF', 'Urine', 0),
            ('UA_MICRO', 900604, 'Urine RBC', 0.0, 2.0, 0.0, 50.0, '/HPF', 'Urine', 0),
            ('UA_MICRO', 900605, 'Urine Bacteria Score', 0.0, 1.0, 0.0, 4.0, 'score', 'Urine', 0)
    ) as t(lab_family, itemid, label, ref_low, ref_high, ext_low, ext_high, valueuom, specimen, decimals)
), expanded as (
    select
        co.subject_id,
        co.hadm_id,
        co.source_order_id,
        co.source_order_name,
        co.lab_family,
        fc.itemid,
        fc.label,
        fc.ref_low,
        fc.ref_high,
        fc.ext_low,
        fc.ext_high,
        fc.valueuom,
        fc.specimen,
        fc.decimals,
        co.ordertime,
        co.resulttime,
        co.admittime,
        co.dischtime,
        co.gender
    from classified_orders co
    join family_components fc
      on fc.lab_family = co.lab_family
    where co.lab_family is not null
), generated as (
    select
        e.subject_id,
        e.hadm_id,
        e.source_order_id,
        e.source_order_name,
        case
            when e.resulttime is not null then e.resulttime
            else least(
                coalesce(e.dischtime, e.ordertime + interval '6 hours'),
                e.ordertime + make_interval(mins => 15 + floor(mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'delay') * 360)::int)
            )
        end as charttime,
        e.itemid,
        e.label,
        e.valueuom,
        e.specimen,
        e.ref_low,
        e.ref_high,
        e.decimals,
        case
            when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'm%' then 13.0::numeric
            when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'f%' then 12.0::numeric
            when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'm%' then 39.0::numeric
            when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'f%' then 36.0::numeric
            else e.ref_low
        end as adj_ref_low,
        case
            when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'm%' then 17.0::numeric
            when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'f%' then 15.5::numeric
            when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'm%' then 50.0::numeric
            when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'f%' then 46.0::numeric
            else e.ref_high
        end as adj_ref_high,
        case
            when mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'abn') < 0.86 then
                e.ref_low + (
                    (case
                        when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'm%' then 17.0::numeric
                        when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'f%' then 15.5::numeric
                        when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'm%' then 50.0::numeric
                        when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'f%' then 46.0::numeric
                        else e.ref_high
                    end) -
                    (case
                        when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'm%' then 13.0::numeric
                        when e.label = 'Hemoglobin' and coalesce(e.gender, '') ilike 'f%' then 12.0::numeric
                        when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'm%' then 39.0::numeric
                        when e.label = 'Hematocrit' and coalesce(e.gender, '') ilike 'f%' then 36.0::numeric
                        else e.ref_low
                    end)
                ) * (0.15 + 0.70 * mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'u1'))
            when mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'dir') < 0.5 then
                e.ext_low + (e.ref_low - e.ext_low) * mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'u2')
            else
                e.ref_high + (e.ext_high - e.ref_high) * mimic_synth.stable_uniform(e.source_order_id::text || e.label, 'u3')
        end as raw_value
    from expanded e
)
select
    g.subject_id,
    g.hadm_id,
    g.source_order_id,
    g.source_order_name,
    g.charttime,
    g.itemid,
    g.label,
    case
        when g.decimals = 0 then round(g.raw_value::numeric, 0)
        when g.decimals = 1 then round(g.raw_value::numeric, 1)
        when g.decimals = 2 then round(g.raw_value::numeric, 2)
        else round(g.raw_value::numeric, 3)
    end as valuenum,
    case
        when g.decimals = 0 then round(g.raw_value::numeric, 0)::text
        when g.decimals = 1 then round(g.raw_value::numeric, 1)::text
        when g.decimals = 2 then round(g.raw_value::numeric, 2)::text
        else round(g.raw_value::numeric, 3)::text
    end as value,
    g.valueuom,
    case
        when g.raw_value < g.adj_ref_low then 'L'
        when g.raw_value > g.adj_ref_high then 'H'
        else null
    end as flag,
    g.specimen,
    'empirical_sql_generator'::text as generation_model,
    'v1'::text as generation_version,
    'synthetic'::text as data_origin
from generated g;

create index if not exists synthetic_labevents_hadm_id_idx
    on mimic_synth.synthetic_labevents (hadm_id);
create index if not exists synthetic_labevents_subject_id_idx
    on mimic_synth.synthetic_labevents (subject_id);
create index if not exists synthetic_labevents_charttime_idx
    on mimic_synth.synthetic_labevents (charttime);
create index if not exists synthetic_labevents_source_order_id_idx
    on mimic_synth.synthetic_labevents (source_order_id);

drop table if exists mimic_synth.dataset_metadata cascade;
create table mimic_synth.dataset_metadata (
    object_name text primary key,
    row_count bigint,
    notes text
);

insert into mimic_synth.dataset_metadata (object_name, row_count, notes)
select
    'synthetic_labevents',
    count(*),
    'Deterministic synthetic lab events generated from curated real lab-like orders in mimic_export.mimic_orders; provenance is synthetic'
from mimic_synth.synthetic_labevents;
