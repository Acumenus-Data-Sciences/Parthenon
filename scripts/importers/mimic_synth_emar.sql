create schema if not exists mimic_synth;

drop table if exists mimic_synth.synthetic_emar cascade;

create unlogged table mimic_synth.synthetic_emar as
with med_orders as (
    select
        o.subject_id,
        o.hadm_id,
        o.order_id as source_order_id,
        o.med_name as source_med_name,
        upper(o.med_name) as med_name_upper,
        o.ordertime,
        a.admittime,
        a.dischtime
    from mimic_export.mimic_orders o
    join mimic_export.mimic_admissions a
      on a.hadm_id = o.hadm_id
    where o.hadm_id is not null
      and o.is_medication_order
      and o.med_name is not null
      and o.med_name <> '\N'
), classified as (
    select
        mo.*,
        case
            when med_name_upper like 'ACETAMINOPHEN %TABLET%' then 'ACETAMINOPHEN_PO'
            when med_name_upper like 'ONDANSETRON HCL (PF)%INJECTION%' then 'ONDANSETRON_IV'
            when med_name_upper like 'ONDANSETRON %DISINTEGRATING TABLET%' then 'ONDANSETRON_PO'
            when med_name_upper like 'SODIUM CHLORIDE 0.9 % IV BOLUS%' then 'NS_BOLUS'
            when med_name_upper like 'LACTATED RINGERS IV BOLUS%' then 'LR_BOLUS'
            when med_name_upper like 'LACTATED RINGERS INTRAVENOUS SOLUTION%' then 'LR_INFUSION'
            when med_name_upper like 'SODIUM CHLORIDE 0.9 % INTRAVENOUS SOLUTION%' then 'NS_INFUSION'
            when med_name_upper like 'FENTANYL (PF)%INJECTION SOLUTION%' then 'FENTANYL_IV'
            when med_name_upper like 'OXYCODONE-ACETAMINOPHEN 5 MG-325 MG TABLET%' then 'PERCOCET_PO'
            when med_name_upper like 'OXYCODONE 5 MG TABLET%' then 'OXYCODONE_PO'
            when med_name_upper like 'IBUPROFEN 600 MG TABLET%' then 'IBUPROFEN_PO'
            when med_name_upper like 'MORPHINE 2 MG/ML IV WRAPPER%' then 'MORPHINE_IV_2'
            when med_name_upper like 'MORPHINE 4 MG/ML IV WRAPPER%' then 'MORPHINE_IV_4'
            when med_name_upper like 'INSULIN LISPRO (U-100)%' then 'INSULIN_LISPRO_SC'
            when med_name_upper like 'INSULIN GLARGINE (U-100)%' then 'INSULIN_GLARGINE_SC'
            when med_name_upper like 'KETOROLAC 15 MG/ML INJECTION SOLUTION%' then 'KETOROLAC_IV_15'
            when med_name_upper like 'KETOROLAC 30 MG/ML (1 ML) INJECTION SOLUTION%' then 'KETOROLAC_IV_30'
            when med_name_upper like 'PANTOPRAZOLE 40 MG TABLET%' then 'PANTOPRAZOLE_PO'
            when med_name_upper like 'IPRATROPIUM-ALBUTEROL 0.5-2.5 (3) MG/3ML IN SOLN%' then 'DUONEB_INH'
            when med_name_upper like 'HYDROMORPHONE 0.5 MG/0.5 ML INJECTION%' then 'HYDROMORPHONE_IV_05'
            when med_name_upper like 'HYDROMORPHONE 1 MG/ML INJECTION%' then 'HYDROMORPHONE_IV_1'
            when med_name_upper like 'HEPARIN (PORCINE) 5,000 UNIT/ML INJECTION SOLUTION%' then 'HEPARIN_SC'
            when med_name_upper like 'FAMOTIDINE 20 MG TABLET%' then 'FAMOTIDINE_PO'
            when med_name_upper like 'ALBUTEROL SULFATE 2.5 MG/3 ML%' then 'ALBUTEROL_NEB'
            when med_name_upper like 'CEFAZOLIN 2 GRAM/100 ML%' then 'CEFAZOLIN_IV'
            when med_name_upper like 'CEFTRIAXONE 1 GRAM/50 ML%' then 'CEFTRIAXONE_IV'
            when med_name_upper like 'POTASSIUM CHLORIDE ER 20 MEQ TABLET%' then 'KCL_PO'
            when med_name_upper like 'POTASSIUM CHLORIDE 20 MEQ/100ML%' then 'KCL_IV'
            when med_name_upper like 'PREDNISONE 20 MG TABLET%' then 'PREDNISONE_PO'
            when med_name_upper like 'ASPIRIN 81 MG TABLET%' then 'ASPIRIN_PO'
            when med_name_upper like 'ENOXAPARIN 40 MG/0.4 ML%' then 'ENOXAPARIN_SC'
            when med_name_upper like 'FUROSEMIDE 10 MG/ML INJECTION SOLUTION%' then 'FUROSEMIDE_IV'
            when med_name_upper like 'MAGNESIUM SULFATE 2 GRAM/50 ML%' then 'MAGNESIUM_IV'
            when med_name_upper like 'LORAZEPAM 2 MG/ML INJECTION SOLUTION%' then 'LORAZEPAM_IV'
            when med_name_upper like 'AMLODIPINE 5 MG TABLET%' then 'AMLODIPINE_PO'
            else null
        end as med_family
    from med_orders mo
), family_rules as (
    select * from (
        values
            ('ACETAMINOPHEN_PO', 'Acetaminophen', 'PO', 'mg', 650::numeric, 4, 0.92),
            ('ONDANSETRON_IV', 'Ondansetron', 'IV', 'mg', 4, 2, 0.70),
            ('ONDANSETRON_PO', 'Ondansetron', 'PO', 'mg', 4, 2, 0.70),
            ('NS_BOLUS', 'Sodium chloride 0.9%', 'IV', 'mL', 1000, 1, 0.98),
            ('LR_BOLUS', 'Lactated Ringers', 'IV', 'mL', 1000, 1, 0.98),
            ('LR_INFUSION', 'Lactated Ringers', 'IV', 'mL', 1000, 2, 0.85),
            ('NS_INFUSION', 'Sodium chloride 0.9%', 'IV', 'mL', 1000, 2, 0.85),
            ('FENTANYL_IV', 'Fentanyl', 'IV', 'mcg', 50, 3, 0.72),
            ('PERCOCET_PO', 'Oxycodone-acetaminophen', 'PO', 'tablet', 1, 4, 0.80),
            ('OXYCODONE_PO', 'Oxycodone', 'PO', 'mg', 5, 4, 0.80),
            ('IBUPROFEN_PO', 'Ibuprofen', 'PO', 'mg', 600, 3, 0.78),
            ('MORPHINE_IV_2', 'Morphine', 'IV', 'mg', 2, 3, 0.70),
            ('MORPHINE_IV_4', 'Morphine', 'IV', 'mg', 4, 3, 0.70),
            ('INSULIN_LISPRO_SC', 'Insulin lispro', 'SC', 'units', 4, 6, 0.88),
            ('INSULIN_GLARGINE_SC', 'Insulin glargine', 'SC', 'units', 10, 2, 0.90),
            ('KETOROLAC_IV_15', 'Ketorolac', 'IV', 'mg', 15, 3, 0.76),
            ('KETOROLAC_IV_30', 'Ketorolac', 'IV', 'mg', 30, 3, 0.76),
            ('PANTOPRAZOLE_PO', 'Pantoprazole', 'PO', 'mg', 40, 2, 0.88),
            ('DUONEB_INH', 'Ipratropium-albuterol', 'INH', 'neb', 1, 4, 0.84),
            ('HYDROMORPHONE_IV_05', 'Hydromorphone', 'IV', 'mg', 0.5, 3, 0.72),
            ('HYDROMORPHONE_IV_1', 'Hydromorphone', 'IV', 'mg', 1, 3, 0.72),
            ('HEPARIN_SC', 'Heparin', 'SC', 'units', 5000, 3, 0.90),
            ('FAMOTIDINE_PO', 'Famotidine', 'PO', 'mg', 20, 2, 0.86),
            ('ALBUTEROL_NEB', 'Albuterol', 'INH', 'neb', 1, 4, 0.82),
            ('CEFAZOLIN_IV', 'Cefazolin', 'IV', 'g', 2, 3, 0.88),
            ('CEFTRIAXONE_IV', 'Ceftriaxone', 'IV', 'g', 1, 2, 0.88),
            ('KCL_PO', 'Potassium chloride', 'PO', 'mEq', 20, 3, 0.82),
            ('KCL_IV', 'Potassium chloride', 'IV', 'mEq', 20, 2, 0.80),
            ('PREDNISONE_PO', 'Prednisone', 'PO', 'mg', 20, 2, 0.80),
            ('ASPIRIN_PO', 'Aspirin', 'PO', 'mg', 81, 2, 0.90),
            ('ENOXAPARIN_SC', 'Enoxaparin', 'SC', 'mg', 40, 2, 0.88),
            ('FUROSEMIDE_IV', 'Furosemide', 'IV', 'mg', 20, 2, 0.74),
            ('MAGNESIUM_IV', 'Magnesium sulfate', 'IV', 'g', 2, 2, 0.82),
            ('LORAZEPAM_IV', 'Lorazepam', 'IV', 'mg', 1, 2, 0.70),
            ('AMLODIPINE_PO', 'Amlodipine', 'PO', 'mg', 5, 2, 0.90)
    ) as t(med_family, medication, route, dose_unit, base_dose, max_admins, admin_probability)
), candidate_orders as (
    select
        c.subject_id,
        c.hadm_id,
        c.source_order_id,
        c.source_med_name,
        fr.medication,
        fr.route,
        fr.dose_unit,
        fr.base_dose,
        fr.max_admins,
        c.ordertime,
        c.admittime,
        c.dischtime,
        greatest(
            1,
            least(
                fr.max_admins,
                1 + floor(mimic_synth.stable_uniform(c.source_order_id::text, 'admin_count') * fr.max_admins)::int
            )
        ) as admin_count
    from classified c
    join family_rules fr
      on fr.med_family = c.med_family
    where c.med_family is not null
      and mimic_synth.stable_uniform(c.source_order_id::text, 'include') <= fr.admin_probability
), expanded as (
    select
        co.*,
        gs.admin_seq
    from candidate_orders co
    cross join lateral generate_series(1, co.admin_count) as gs(admin_seq)
), generated as (
    select
        e.subject_id,
        e.hadm_id,
        e.source_order_id,
        e.source_med_name,
        e.medication,
        e.route,
        case
            when e.route = 'IV' and e.max_admins = 1 then 'Bolus Given'
            when e.route = 'IV' then 'Given'
            when e.route = 'SC' then 'Given'
            when e.route = 'INH' then 'Given'
            else 'Administered'
        end as action,
        case
            when e.route = 'IV' and e.max_admins = 1 then 'Complete'
            else 'Given'
        end as status,
        e.dose_unit,
        case
            when e.dose_unit = 'units' then round((e.base_dose * (0.7 + 0.8 * mimic_synth.stable_uniform(e.source_order_id::text || e.admin_seq, 'dose')))::numeric, 0)
            when e.dose_unit in ('tablet', 'neb') then e.base_dose
            when e.dose_unit in ('g', 'mEq', 'mL') then round((e.base_dose * (0.85 + 0.3 * mimic_synth.stable_uniform(e.source_order_id::text || e.admin_seq, 'dose')))::numeric, 0)
            else round((e.base_dose * (0.8 + 0.4 * mimic_synth.stable_uniform(e.source_order_id::text || e.admin_seq, 'dose')))::numeric, 1)
        end as dose,
        least(
            coalesce(e.dischtime, e.ordertime + interval '7 days'),
            greatest(
                e.ordertime,
                e.ordertime
                + make_interval(
                    mins => case
                        when e.admin_count = 1 then floor(15 + 180 * mimic_synth.stable_uniform(e.source_order_id::text, 't1'))::int
                        else floor(
                            (
                                extract(epoch from greatest(
                                    interval '30 minutes',
                                    coalesce(e.dischtime, e.ordertime + interval '2 days') - e.ordertime
                                )) / 60.0
                            ) * (e.admin_seq::double precision / (e.admin_count + 1)::double precision)
                            + 10 * mimic_synth.stable_uniform(e.source_order_id::text || e.admin_seq, 'jitter')
                        )::int
                    end
                )
            )
        ) as charttime
    from expanded e
)
select
    subject_id,
    hadm_id,
    source_order_id,
    source_med_name,
    medication,
    charttime,
    route,
    action,
    status,
    dose,
    dose_unit,
    'empirical_sql_generator'::text as generation_model,
    'v1'::text as generation_version,
    'synthetic'::text as data_origin
from generated;

create index if not exists synthetic_emar_hadm_id_idx
    on mimic_synth.synthetic_emar (hadm_id);
create index if not exists synthetic_emar_subject_id_idx
    on mimic_synth.synthetic_emar (subject_id);
create index if not exists synthetic_emar_charttime_idx
    on mimic_synth.synthetic_emar (charttime);
create index if not exists synthetic_emar_source_order_id_idx
    on mimic_synth.synthetic_emar (source_order_id);

create table if not exists mimic_synth.dataset_metadata (
    object_name text primary key,
    row_count bigint,
    notes text
);

insert into mimic_synth.dataset_metadata (object_name, row_count, notes)
select
    'synthetic_emar',
    count(*),
    'Deterministic synthetic medication administration events generated from curated real medication-like orders in mimic_export.mimic_orders; provenance is synthetic'
from mimic_synth.synthetic_emar
on conflict (object_name) do update
set row_count = excluded.row_count,
    notes = excluded.notes;
