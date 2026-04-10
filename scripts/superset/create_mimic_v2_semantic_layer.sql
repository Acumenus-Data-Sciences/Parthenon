-- MIMIC-IV Superset v2 semantic layer
-- Target DB: parthenon / schema: mimiciv
-- Creates a curated analytics schema for Superset.

create schema if not exists superset_mimic;

drop materialized view if exists superset_mimic.data_quality_summary cascade;
drop materialized view if exists superset_mimic.discharge_outcome_summary cascade;
drop materialized view if exists superset_mimic.unit_daily_census cascade;
drop materialized view if exists superset_mimic.infusion_category_summary cascade;
drop materialized view if exists superset_mimic.micro_resistance_summary cascade;
drop materialized view if exists superset_mimic.vital_daily_summary cascade;
drop materialized view if exists superset_mimic.lab_daily_summary cascade;
drop materialized view if exists superset_mimic.admission_diagnosis_summary cascade;
drop materialized view if exists superset_mimic.admission_readmission_fact cascade;
drop materialized view if exists superset_mimic.icu_episode_fact cascade;

-- One row per ICU stay.
create materialized view superset_mimic.icu_episode_fact as
with apr_drg as (
    select hadm_id, drg_code, description, drg_severity, drg_mortality
    from (
        select
            d.hadm_id,
            d.drg_code,
            d.description,
            case when nullif(btrim(d.drg_severity), '') ~ '^[0-9]+$' then d.drg_severity::int end as drg_severity,
            case when nullif(btrim(d.drg_mortality), '') ~ '^[0-9]+$' then d.drg_mortality::int end as drg_mortality,
            row_number() over (
                partition by d.hadm_id
                order by
                    case when nullif(btrim(d.drg_severity), '') ~ '^[0-9]+$' then d.drg_severity::int end desc nulls last,
                    case when nullif(btrim(d.drg_mortality), '') ~ '^[0-9]+$' then d.drg_mortality::int end desc nulls last,
                    d.drg_code
            ) as rn
        from mimiciv.drgcodes d
        where d.drg_type = 'APR'
    ) ranked
    where rn = 1
),
first_service as (
    select hadm_id, curr_service
    from (
        select
            s.hadm_id,
            s.curr_service,
            row_number() over (
                partition by s.hadm_id
                order by
                    case when nullif(btrim(s.transfertime), '') is not null then s.transfertime::timestamp end asc nulls last,
                    s.curr_service
            ) as rn
        from mimiciv.services s
    ) ranked
    where rn = 1
)
select
    i.stay_id,
    a.hadm_id,
    a.subject_id,
    a.admittime::timestamp as admit_time,
    a.dischtime::timestamp as discharge_time,
    i.intime::timestamp as icu_intime,
    i.outtime::timestamp as icu_outtime,
    case when nullif(btrim(p.anchor_age), '') ~ '^[0-9]+$' then p.anchor_age::int end as age,
    case
        when nullif(btrim(p.anchor_age), '') !~ '^[0-9]+$' then 'Unknown'
        when p.anchor_age::int < 40 then '18-39'
        when p.anchor_age::int < 60 then '40-59'
        when p.anchor_age::int < 75 then '60-74'
        else '75+'
    end as age_group,
    p.gender,
    a.admission_type,
    a.insurance,
    i.first_careunit as icu_unit,
    fs.curr_service as service,
    extract(epoch from (a.dischtime::timestamp - a.admittime::timestamp)) / 86400.0 as hospital_los_days,
    case when nullif(btrim(i.los), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then i.los::numeric end as icu_los_days,
    case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital,
    case
        when nullif(btrim(p.dod), '') is not null
         and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp)) / 86400.0 <= 30
        then 1 else 0
    end as death_within_30d,
    case
        when nullif(btrim(p.dod), '') is not null
         and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp)) / 86400.0 <= 365
        then 1 else 0
    end as death_within_1yr,
    apr.drg_severity,
    apr.drg_mortality as drg_mortality_risk,
    apr.description as drg_description,
    a.discharge_location,
    case
        when a.hospital_expire_flag = '1' then 'Died in hospital'
        when nullif(btrim(p.dod), '') is not null
         and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp)) / 86400.0 <= 30
        then 'Died within 30d'
        when nullif(btrim(p.dod), '') is not null
         and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp)) / 86400.0 <= 365
        then 'Died within 1yr'
        else 'Alive at 1yr'
    end as outcome_group
from mimiciv.icustays i
join mimiciv.admissions a on i.hadm_id = a.hadm_id
join mimiciv.patients p on a.subject_id = p.subject_id
left join apr_drg apr on a.hadm_id = apr.hadm_id
left join first_service fs on a.hadm_id = fs.hadm_id;

create unique index if not exists superset_mimic_icu_episode_fact_stay_id_idx
    on superset_mimic.icu_episode_fact (stay_id);
create index if not exists superset_mimic_icu_episode_fact_hadm_id_idx
    on superset_mimic.icu_episode_fact (hadm_id);
create index if not exists superset_mimic_icu_episode_fact_subject_id_idx
    on superset_mimic.icu_episode_fact (subject_id);
create index if not exists superset_mimic_icu_episode_fact_unit_idx
    on superset_mimic.icu_episode_fact (icu_unit);
create index if not exists superset_mimic_icu_episode_fact_admit_time_idx
    on superset_mimic.icu_episode_fact (admit_time);

-- One row per admission with readmission features.
create materialized view superset_mimic.admission_readmission_fact as
with ordered as (
    select
        a.hadm_id,
        a.subject_id,
        a.admittime::timestamp as admit_time,
        a.dischtime::timestamp as discharge_time,
        a.admission_type,
        a.discharge_location,
        a.insurance,
        p.gender,
        case when nullif(btrim(p.anchor_age), '') ~ '^[0-9]+$' then p.anchor_age::int end as age,
        case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital,
        lag(a.dischtime::timestamp) over (
            partition by a.subject_id order by a.admittime::timestamp
        ) as prior_discharge_time,
        lead(a.admittime::timestamp) over (
            partition by a.subject_id order by a.admittime::timestamp
        ) as next_admit_time,
        row_number() over (
            partition by a.subject_id order by a.admittime::timestamp
        ) as admission_number,
        count(*) over (partition by a.subject_id) as total_admissions_for_patient
    from mimiciv.admissions a
    join mimiciv.patients p on a.subject_id = p.subject_id
)
select
    hadm_id,
    subject_id,
    admit_time,
    discharge_time,
    admission_type,
    discharge_location,
    insurance,
    gender,
    age,
    case
        when age is null then 'Unknown'
        when age < 40 then '18-39'
        when age < 60 then '40-59'
        when age < 75 then '60-74'
        else '75+'
    end as age_group,
    died_in_hospital,
    extract(epoch from (discharge_time - admit_time)) / 86400.0 as los_days,
    case
        when prior_discharge_time is not null
        then extract(epoch from (admit_time - prior_discharge_time)) / 86400.0
    end as days_since_prior_discharge,
    case
        when next_admit_time is not null
        then extract(epoch from (next_admit_time - discharge_time)) / 86400.0
    end as days_to_next_admission,
    admission_number,
    total_admissions_for_patient,
    case when admission_number = 1 then 1 else 0 end as is_index_admission,
    case
        when next_admit_time is not null
         and extract(epoch from (next_admit_time - discharge_time)) / 86400.0 <= 7
        then 1 else 0
    end as readmit_7d,
    case
        when next_admit_time is not null
         and extract(epoch from (next_admit_time - discharge_time)) / 86400.0 <= 30
        then 1 else 0
    end as readmit_30d,
    case
        when total_admissions_for_patient > 1 then 'Readmitted'
        else 'Single admission'
    end as readmission_status
from ordered;

create unique index if not exists superset_mimic_admission_readmission_fact_hadm_id_idx
    on superset_mimic.admission_readmission_fact (hadm_id);
create index if not exists superset_mimic_admission_readmission_fact_subject_id_idx
    on superset_mimic.admission_readmission_fact (subject_id);
create index if not exists superset_mimic_admission_readmission_fact_admit_time_idx
    on superset_mimic.admission_readmission_fact (admit_time);

-- One row per admission summarizing diagnosis burden.
create materialized view superset_mimic.admission_diagnosis_summary as
with diagnosis_ranked as (
    select
        d.hadm_id,
        d.subject_id,
        d.icd_code,
        d.icd_version,
        dd.long_title as diagnosis,
        case when nullif(btrim(d.seq_num), '') ~ '^[0-9]+$' then d.seq_num::int end as diagnosis_rank,
        row_number() over (
            partition by d.hadm_id
            order by
                case when nullif(btrim(d.seq_num), '') ~ '^[0-9]+$' then d.seq_num::int end asc nulls last,
                d.icd_code
        ) as rn,
        count(*) over (partition by d.hadm_id) as diagnosis_count
    from mimiciv.diagnoses_icd d
    left join mimiciv.d_icd_diagnoses dd
        on d.icd_code = dd.icd_code
       and d.icd_version = dd.icd_version
    where nullif(btrim(d.seq_num), '') is not null
),
first_service as (
    select hadm_id, curr_service
    from (
        select
            s.hadm_id,
            s.curr_service,
            row_number() over (
                partition by s.hadm_id
                order by
                    case when nullif(btrim(s.transfertime), '') is not null then s.transfertime::timestamp end asc nulls last,
                    s.curr_service
            ) as rn
        from mimiciv.services s
    ) ranked
    where rn = 1
)
select
    a.hadm_id,
    a.subject_id,
    p.gender,
    case when nullif(btrim(p.anchor_age), '') ~ '^[0-9]+$' then p.anchor_age::int end as age,
    case
        when nullif(btrim(p.anchor_age), '') !~ '^[0-9]+$' then 'Unknown'
        when p.anchor_age::int < 40 then '18-39'
        when p.anchor_age::int < 60 then '40-59'
        when p.anchor_age::int < 75 then '60-74'
        else '75+'
    end as age_group,
    case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital,
    extract(epoch from (a.dischtime::timestamp - a.admittime::timestamp)) / 86400.0 as hospital_los_days,
    coalesce(dr.diagnosis_count, 0) as diagnosis_count,
    dr.icd_code as primary_icd_code,
    dr.icd_version as primary_icd_version,
    coalesce(dr.diagnosis, dr.icd_code) as primary_diagnosis,
    dr.diagnosis_rank as primary_diagnosis_rank,
    fs.curr_service as service,
    exists (
        select 1
        from mimiciv.icustays i
        where i.hadm_id = a.hadm_id
    )::int as icu_exposure
from mimiciv.admissions a
join mimiciv.patients p on a.subject_id = p.subject_id
left join diagnosis_ranked dr
    on a.hadm_id = dr.hadm_id
   and dr.rn = 1
left join first_service fs
    on a.hadm_id = fs.hadm_id;

create unique index if not exists superset_mimic_admission_diagnosis_summary_hadm_id_idx
    on superset_mimic.admission_diagnosis_summary (hadm_id);
create index if not exists superset_mimic_admission_diagnosis_summary_primary_dx_idx
    on superset_mimic.admission_diagnosis_summary (primary_diagnosis);

-- One row per admission-lab-calendar day.
create materialized view superset_mimic.lab_daily_summary as
with icu_window as (
    select
        hadm_id,
        min(intime::timestamp) as first_icu_intime
    from mimiciv.icustays
    group by hadm_id
),
lab_base as (
    select
        le.subject_id,
        le.hadm_id,
        di.label as lab_test,
        le.charttime::timestamp as chart_time,
        date_trunc('day', le.charttime::timestamp)::date as calendar_day,
        case when nullif(btrim(le.valuenum), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then le.valuenum::numeric end as value_num,
        le.valueuom as unit,
        case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital,
        iw.first_icu_intime
    from mimiciv.labevents le
    join mimiciv.d_labitems di
        on le.itemid::int = di.itemid::int
    join mimiciv.admissions a
        on le.hadm_id = a.hadm_id
    left join icu_window iw
        on le.hadm_id = iw.hadm_id
    where nullif(btrim(le.valuenum), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      and di.label in (
        'Creatinine', 'Glucose', 'Potassium', 'Sodium', 'Hemoglobin',
        'Platelet Count', 'White Blood Cells', 'Lactate', 'Troponin T',
        'Urea Nitrogen', 'Bicarbonate', 'Anion Gap', 'Chloride',
        'Alanine Aminotransferase (ALT)', 'Aspartate Aminotransferase (AST)',
        'Bilirubin, Total', 'INR(PT)', 'pH'
      )
)
select
    subject_id,
    hadm_id,
    lab_test,
    calendar_day,
    case
        when first_icu_intime is not null
        then floor(extract(epoch from (chart_time - first_icu_intime)) / 86400.0)::int
    end as icu_day,
    min(chart_time) as first_sample_time,
    max(chart_time) as last_sample_time,
    avg(value_num) as mean_value,
    percentile_cont(0.5) within group (order by value_num) as median_value,
    min(value_num) as min_value,
    max(value_num) as max_value,
    count(*) as sample_count,
    died_in_hospital
from lab_base
group by subject_id, hadm_id, lab_test, calendar_day, icu_day, died_in_hospital;

create index if not exists superset_mimic_lab_daily_summary_lab_day_idx
    on superset_mimic.lab_daily_summary (lab_test, icu_day);
create index if not exists superset_mimic_lab_daily_summary_hadm_idx
    on superset_mimic.lab_daily_summary (hadm_id);

-- One row per stay-vital-calendar day.
create materialized view superset_mimic.vital_daily_summary as
with vital_base as (
    select
        ce.subject_id,
        ce.hadm_id,
        ce.stay_id,
        di.label as vital_sign,
        ce.charttime::timestamp as chart_time,
        date_trunc('day', ce.charttime::timestamp)::date as calendar_day,
        case when nullif(btrim(ce.valuenum), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then ce.valuenum::numeric end as value_num,
        i.intime::timestamp as icu_intime,
        i.first_careunit as icu_unit,
        case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital
    from mimiciv.chartevents ce
    join mimiciv.d_items di
        on ce.itemid::int = di.itemid::int
    join mimiciv.icustays i
        on ce.stay_id = i.stay_id
    join mimiciv.admissions a
        on ce.hadm_id = a.hadm_id
    where di.label in (
        'Heart Rate',
        'Respiratory Rate',
        'O2 saturation pulseoxymetry',
        'Non Invasive Blood Pressure systolic',
        'Non Invasive Blood Pressure diastolic',
        'Temperature Fahrenheit'
    )
      and nullif(btrim(ce.valuenum), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      and ce.valuenum::numeric > 0
      and ce.valuenum::numeric < 500
)
select
    subject_id,
    hadm_id,
    stay_id,
    vital_sign,
    icu_unit,
    calendar_day,
    floor(extract(epoch from (min(chart_time) - icu_intime)) / 86400.0)::int as icu_day,
    avg(value_num) as mean_value,
    percentile_cont(0.5) within group (order by value_num) as median_value,
    min(value_num) as min_value,
    max(value_num) as max_value,
    count(*) as sample_count,
    died_in_hospital
from vital_base
group by subject_id, hadm_id, stay_id, vital_sign, icu_unit, calendar_day, icu_intime, died_in_hospital;

create index if not exists superset_mimic_vital_daily_summary_sign_day_idx
    on superset_mimic.vital_daily_summary (vital_sign, icu_day);
create index if not exists superset_mimic_vital_daily_summary_stay_idx
    on superset_mimic.vital_daily_summary (stay_id);

-- One row per organism-antibiotic pair.
create materialized view superset_mimic.micro_resistance_summary as
select
    m.org_name as organism,
    m.ab_name as antibiotic,
    count(*) as test_count,
    count(*) filter (where m.interpretation = 'R') as resistant_count,
    count(*) filter (where m.interpretation = 'I') as intermediate_count,
    count(*) filter (where m.interpretation = 'S') as susceptible_count,
    round(100.0 * count(*) filter (where m.interpretation = 'R') / nullif(count(*), 0), 2) as resistance_pct,
    count(distinct m.subject_id) as patient_count
from mimiciv.microbiologyevents m
where m.org_name is not null
  and m.ab_name is not null
  and m.interpretation is not null
group by m.org_name, m.ab_name;

create unique index if not exists superset_mimic_micro_resistance_summary_pair_idx
    on superset_mimic.micro_resistance_summary (organism, antibiotic);

-- One row per admission and infusion category.
create materialized view superset_mimic.infusion_category_summary as
select
    ie.hadm_id,
    ie.subject_id,
    i.first_careunit as icu_unit,
    ie.ordercategoryname as category,
    count(*) as event_count,
    sum(case when nullif(btrim(ie.amount), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then ie.amount::numeric else 0 end) as total_amount,
    avg(case when nullif(btrim(ie.amount), '') ~ '^-?[0-9]+(\.[0-9]+)?$' then ie.amount::numeric end) as avg_amount,
    sum(extract(epoch from (ie.endtime::timestamp - ie.starttime::timestamp)) / 3600.0) as total_duration_hours,
    case when max(a.hospital_expire_flag) = '1' then 1 else 0 end as died_in_hospital
from mimiciv.inputevents ie
join mimiciv.admissions a on ie.hadm_id = a.hadm_id
join mimiciv.icustays i on ie.stay_id = i.stay_id
where nullif(btrim(ie.amount), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
  and ie.amount::numeric > 0
group by ie.hadm_id, ie.subject_id, i.first_careunit, ie.ordercategoryname;

create index if not exists superset_mimic_infusion_category_summary_category_idx
    on superset_mimic.infusion_category_summary (category);
create index if not exists superset_mimic_infusion_category_summary_hadm_idx
    on superset_mimic.infusion_category_summary (hadm_id);

-- One row per ICU unit per day.
create materialized view superset_mimic.unit_daily_census as
with expanded as (
    select
        i.stay_id,
        i.subject_id,
        i.hadm_id,
        i.first_careunit as icu_unit,
        i.intime::timestamp as icu_intime,
        i.outtime::timestamp as icu_outtime,
        gs::date as calendar_day,
        case when a.hospital_expire_flag = '1' then 1 else 0 end as died_in_hospital
    from mimiciv.icustays i
    join mimiciv.admissions a on i.hadm_id = a.hadm_id
    cross join lateral generate_series(
        date_trunc('day', i.intime::timestamp),
        date_trunc('day', coalesce(i.outtime::timestamp, i.intime::timestamp)),
        interval '1 day'
    ) gs
)
select
    calendar_day,
    icu_unit,
    count(distinct stay_id) as active_stays,
    count(distinct stay_id) filter (where date_trunc('day', icu_intime)::date = calendar_day) as new_stays,
    count(distinct stay_id) filter (where date_trunc('day', icu_outtime)::date = calendar_day) as discharges,
    count(distinct stay_id) filter (
        where date_trunc('day', icu_outtime)::date = calendar_day and died_in_hospital = 1
    ) as deaths
from expanded
group by calendar_day, icu_unit;

create unique index if not exists superset_mimic_unit_daily_census_day_unit_idx
    on superset_mimic.unit_daily_census (calendar_day, icu_unit);

-- One row per discharge subgroup.
create materialized view superset_mimic.discharge_outcome_summary as
with service_first as (
    select hadm_id, curr_service
    from (
        select
            s.hadm_id,
            s.curr_service,
            row_number() over (
                partition by s.hadm_id
                order by
                    case when nullif(btrim(s.transfertime), '') is not null then s.transfertime::timestamp end asc nulls last,
                    s.curr_service
            ) as rn
        from mimiciv.services s
    ) ranked
    where rn = 1
),
icu_first as (
    select hadm_id, first_careunit
    from (
        select
            i.hadm_id,
            i.first_careunit,
            row_number() over (
                partition by i.hadm_id
                order by i.intime::timestamp asc nulls last
            ) as rn
        from mimiciv.icustays i
    ) ranked
    where rn = 1
),
base as (
    select
        ar.hadm_id,
        ar.subject_id,
        ar.age_group,
        ar.gender,
        ar.died_in_hospital,
        ar.readmit_30d,
        ar.discharge_location,
        sf.curr_service as service,
        icu.first_careunit as icu_unit
    from superset_mimic.admission_readmission_fact ar
    left join service_first sf on ar.hadm_id = sf.hadm_id
    left join icu_first icu on ar.hadm_id = icu.hadm_id
)
select
    coalesce(discharge_location, 'Unknown') as discharge_location,
    age_group,
    gender,
    coalesce(service, 'Unknown') as service,
    coalesce(icu_unit, 'No ICU') as icu_unit,
    count(*) as admission_count,
    sum(died_in_hospital) as death_count,
    sum(readmit_30d) as readmit_30d_count,
    round(100.0 * sum(died_in_hospital) / nullif(count(*), 0), 2) as mortality_pct,
    round(100.0 * sum(readmit_30d) / nullif(count(*), 0), 2) as readmit_30d_pct
from base
group by coalesce(discharge_location, 'Unknown'), age_group, gender, coalesce(service, 'Unknown'), coalesce(icu_unit, 'No ICU');

create index if not exists superset_mimic_discharge_outcome_summary_discharge_idx
    on superset_mimic.discharge_outcome_summary (discharge_location);
create index if not exists superset_mimic_discharge_outcome_summary_service_idx
    on superset_mimic.discharge_outcome_summary (service);

-- One row per source object with simple analytical DQ metadata.
create materialized view superset_mimic.data_quality_summary as
select
    'patients'::text as source_object,
    count(*)::bigint as row_count,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint as null_subject_id_count,
    null::bigint as null_hadm_id_count,
    null::timestamp as min_time,
    null::timestamp as max_time,
    null::numeric as orphan_rate_pct,
    'Subject-level demographics'::text as notes
from mimiciv.patients
union all
select
    'admissions',
    count(*)::bigint,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint,
    count(*) filter (where nullif(btrim(hadm_id), '') is null)::bigint,
    min(admittime::timestamp),
    max(admittime::timestamp),
    null::numeric,
    'Hospital encounters'
from mimiciv.admissions
union all
select
    'icustays',
    count(*)::bigint,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint,
    count(*) filter (where nullif(btrim(hadm_id), '') is null)::bigint,
    min(intime::timestamp),
    max(outtime::timestamp),
    round(
        100.0 * count(*) filter (
            where not exists (
                select 1 from mimiciv.admissions a where a.hadm_id = mimiciv.icustays.hadm_id
            )
        ) / nullif(count(*), 0),
        4
    ),
    'ICU stay records'
from mimiciv.icustays
union all
select
    'labevents',
    count(*)::bigint,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint,
    count(*) filter (where nullif(btrim(hadm_id), '') is null)::bigint,
    min(charttime::timestamp),
    max(charttime::timestamp),
    round(
        100.0 * count(*) filter (
            where nullif(btrim(itemid), '') is null
        ) / nullif(count(*), 0),
        4
    ),
    'Lab events; orphan metric uses missing itemid rate'
from mimiciv.labevents
union all
select
    'microbiologyevents',
    count(*)::bigint,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint,
    count(*) filter (where nullif(btrim(hadm_id), '') is null)::bigint,
    min(charttime::timestamp),
    max(charttime::timestamp),
    round(
        100.0 * count(*) filter (
            where nullif(btrim(org_name), '') is null
        ) / nullif(count(*), 0),
        4
    ),
    'Microbiology events; orphan metric uses missing organism rate'
from mimiciv.microbiologyevents
union all
select
    'inputevents',
    count(*)::bigint,
    count(*) filter (where nullif(btrim(subject_id), '') is null)::bigint,
    count(*) filter (where nullif(btrim(hadm_id), '') is null)::bigint,
    min(starttime::timestamp),
    max(endtime::timestamp),
    round(
        100.0 * count(*) filter (
            where nullif(btrim(ordercategoryname), '') is null
        ) / nullif(count(*), 0),
        4
    ),
    'ICU infusion and blood product events'
from mimiciv.inputevents;

create unique index if not exists superset_mimic_data_quality_summary_source_object_idx
    on superset_mimic.data_quality_summary (source_object);
