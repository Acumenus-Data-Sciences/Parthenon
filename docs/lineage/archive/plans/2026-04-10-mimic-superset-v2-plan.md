# MIMIC-IV Superset Dashboard v2 Plan

Date: 2026-04-10

## Current live state

Live Superset instance checked at `https://superset.acumenus.net`.

- Dashboard count: 2
- MIMIC dashboard: `MIMIC-IV ICU Clinical Analytics` (`dashboard_id = 3`)
- Chart count on MIMIC dashboard: 12
- Virtual datasets used by MIMIC dashboard: 6

Current chart inventory:

1. `MIMIC: In-Hospital Mortality Rate`
2. `MIMIC: Median ICU Length of Stay`
3. `MIMIC: 30-Day Readmission Rate`
4. `MIMIC: Mortality by ICU Unit`
5. `MIMIC: Patient Outcomes by Age & DRG Severity`
6. `MIMIC: Lab Abnormality Rate by Test (Survivors vs Deaths)`
7. `MIMIC: ICU LOS by Unit (Box Plot)`
8. `MIMIC: Antibiotic Resistance Patterns`
9. `MIMIC: ICU Infusion Categories`
10. `MIMIC: Diagnosis Count vs LOS & Mortality`
11. `MIMIC: Top 20 Primary Diagnoses`
12. `MIMIC: Readmission Frequency Distribution`

Live schema validation against `mimiciv`:

- `patients`: 100 rows
- `admissions`: 275 rows
- `icustays`: 140 rows
- `labevents`: 107727 rows
- `microbiologyevents`: 2899 rows
- `inputevents`: populated
- `drgcodes`: populated, `APR` rows present

Semantic-layer validation on `2026-04-10`:

- `scripts/superset/create_mimic_v2_semantic_layer.sql` was compile-checked against the live `mimiciv` schema in a single transaction and rolled back.
- Observed output row counts:
  - `icu_episode_fact`: `140`
  - `admission_readmission_fact`: `275`
  - `admission_diagnosis_summary`: `275`
  - `lab_daily_summary`: `24199`
  - `vital_daily_summary`: `3487`
  - `micro_resistance_summary`: `216`
  - `infusion_category_summary`: `978`
  - `unit_daily_census`: `629`
  - `discharge_outcome_summary`: `177`
  - `data_quality_summary`: `6`

## Problems in v1

### Metric definition problems

- `30-Day Readmission Rate` currently uses a patient-level denominator.
  - Live value from current dataset logic: about `53.0%`
  - Same event count with admission-level denominator: about `19.3%`
  - Recommendation: expose both
    - `patient_readmit_30d_pct`
    - `admission_readmit_30d_pct`
  - Default primary KPI should be admission-level.

- `Diagnosis Count vs LOS & Mortality` is built on diagnosis-row grain and uses `hadm_id` as the bubble entity with `COUNT(DISTINCT hadm_id)` for size.
  - This collapses bubble size badly.
  - Recommendation: rebuild from one row per admission.

- `ICU LOS by Unit (Box Plot)` uses a metricized config rather than a raw-distribution dataset.
  - Recommendation: feed box plot from one row per ICU stay with raw `icu_los_days`.

### Grain problems

- Labs, microbiology, and infusions are event-weighted.
- High-frequency patients dominate percentages.
- Recommendation:
  - Keep event-weighted panels where clinically justified.
  - Add patient-weighted and admission-weighted companion views.

### Missing analytical depth

Not currently represented:

- temporal ICU census
- service-line flow
- discharge destination
- procedure burden
- organ-system lab trends
- ventilatory/vasopressor utilization
- encounter severity segmentation
- 7-day readmission
- transfer pathway analysis
- outcome-stratified trends
- filterable cohort exploration

## v2 dashboard architecture

Do not build one oversized dashboard. Build one dashboard with tabs or separate dashboards sharing the same native filter model.

Recommended top-level sections:

1. ICU Overview
2. Outcomes & Severity
3. Labs, Vitals & Infection
4. Utilization & Readmission
5. Data Quality & Provenance

## Native filters

Global native filters for all MIMIC dashboards:

- ICU unit
- service
- admission type
- insurance
- gender
- age group
- outcome
- readmission status
- DRG severity band
- DRG mortality risk band
- diagnosis rank
- date range on admission time

Section-specific filters:

- lab test
- lab status
- organism
- antibiotic
- susceptibility
- infusion category
- primary diagnosis
- discharge disposition

## Proposed semantic layer

Create curated views or materialized views. Avoid doing dashboard math directly on raw event tables.

### 1. `superset_mimic.icu_episode_fact`

One row per ICU stay.

Columns:

- `stay_id`
- `hadm_id`
- `subject_id`
- `admit_time`
- `discharge_time`
- `icu_intime`
- `icu_outtime`
- `age`
- `age_group`
- `gender`
- `admission_type`
- `insurance`
- `icu_unit`
- `service`
- `hospital_los_days`
- `icu_los_days`
- `died_in_hospital`
- `death_within_30d`
- `death_within_1yr`
- `drg_severity`
- `drg_mortality_risk`
- `drg_description`
- `discharge_location`

SQL pattern:

```sql
create materialized view superset_mimic.icu_episode_fact as
select
  i.stay_id,
  a.hadm_id,
  a.subject_id,
  a.admittime::timestamp as admit_time,
  a.dischtime::timestamp as discharge_time,
  i.intime::timestamp as icu_intime,
  i.outtime::timestamp as icu_outtime,
  p.anchor_age::int as age,
  case
    when p.anchor_age::int < 40 then '18-39'
    when p.anchor_age::int < 60 then '40-59'
    when p.anchor_age::int < 75 then '60-74'
    else '75+'
  end as age_group,
  p.gender,
  a.admission_type,
  a.insurance,
  i.first_careunit as icu_unit,
  s.curr_service as service,
  extract(epoch from (a.dischtime::timestamp - a.admittime::timestamp))/86400.0 as hospital_los_days,
  extract(epoch from (i.outtime::timestamp - i.intime::timestamp))/86400.0 as icu_los_days,
  (a.hospital_expire_flag::int = 1)::int as died_in_hospital,
  (
    p.dod is not null
    and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp))/86400.0 <= 30
  )::int as death_within_30d,
  (
    p.dod is not null
    and extract(epoch from (p.dod::timestamp - a.dischtime::timestamp))/86400.0 <= 365
  )::int as death_within_1yr,
  d.drg_severity::int as drg_severity,
  d.drg_mortality::int as drg_mortality_risk,
  d.description as drg_description,
  a.discharge_location
from mimiciv.icustays i
join mimiciv.admissions a on i.hadm_id = a.hadm_id
join mimiciv.patients p on a.subject_id = p.subject_id
left join mimiciv.drgcodes d on a.hadm_id = d.hadm_id and d.drg_type = 'APR'
left join mimiciv.services s on a.hadm_id = s.hadm_id
  and s.transfertime::timestamp = (
    select min(s2.transfertime::timestamp)
    from mimiciv.services s2
    where s2.hadm_id = a.hadm_id
  );
```

### 2. `superset_mimic.admission_readmission_fact`

One row per admission with prior-discharge gap and repeat-admission classification.

Derived metrics:

- `is_index_admission`
- `readmit_7d`
- `readmit_30d`
- `days_since_prior_discharge`
- `total_admissions_for_patient`

### 3. `superset_mimic.admission_diagnosis_summary`

One row per admission, not one row per diagnosis.

Columns:

- `hadm_id`
- `subject_id`
- `primary_diagnosis`
- `primary_icd_code`
- `diagnosis_count`
- `hospital_los_days`
- `died_in_hospital`
- `age_group`
- `gender`
- `service`
- `icu_exposure`

### 4. `superset_mimic.lab_daily_summary`

One row per patient-admission-lab-day.

Columns:

- `subject_id`
- `hadm_id`
- `lab_test`
- `icu_day`
- `calendar_day`
- `mean_value`
- `median_value`
- `min_value`
- `max_value`
- `abnormal_any`
- `high_any`
- `low_any`
- `died_in_hospital`

### 5. `superset_mimic.vital_daily_summary`

One row per patient-stay-vital-day.

Columns:

- `stay_id`
- `subject_id`
- `hadm_id`
- `vital_sign`
- `icu_day`
- `mean_value`
- `median_value`
- `min_value`
- `max_value`
- `died_in_hospital`
- `icu_unit`

### 6. `superset_mimic.micro_resistance_summary`

One row per organism-antibiotic combination.

Columns:

- `organism`
- `antibiotic`
- `test_count`
- `resistant_count`
- `intermediate_count`
- `susceptible_count`
- `resistance_pct`
- `patient_count`

### 7. `superset_mimic.infusion_category_summary`

One row per admission-category.

Columns:

- `hadm_id`
- `subject_id`
- `icu_unit`
- `category`
- `event_count`
- `total_amount`
- `total_duration_hours`
- `died_in_hospital`

### 8. `superset_mimic.unit_daily_census`

One row per ICU unit per day.

Columns:

- `calendar_day`
- `icu_unit`
- `active_stays`
- `new_stays`
- `discharges`
- `deaths`

### 9. `superset_mimic.discharge_outcome_summary`

One row per discharge category / subgroup.

Columns:

- `discharge_location`
- `age_group`
- `service`
- `icu_unit`
- `admission_count`
- `death_count`
- `readmit_30d_count`

### 10. `superset_mimic.data_quality_summary`

One row per analytical source object.

Columns:

- `source_object`
- `row_count`
- `null_rate_key_fields`
- `min_time`
- `max_time`
- `orphan_rate`
- `notes`

## Dashboard v2 chart plan

### Section 1: ICU Overview

1. Big number: ICU admissions
2. Big number: unique ICU patients
3. Big number: hospital mortality %
4. Big number: median ICU LOS
5. Big number: 7-day readmission %
6. Big number: 30-day readmission %
7. Line + bars: monthly ICU admissions with mortality %
8. Area chart: daily ICU census by unit
9. Box plot: ICU LOS by unit
10. Bar chart: mortality by ICU unit
11. Pivot table: unit benchmark table

### Section 2: Outcomes & Severity

12. Heatmap: age group x DRG severity mortality %
13. Heatmap: DRG mortality risk x discharge location
14. Scatter: ICU LOS vs hospital LOS by outcome
15. Bar chart: primary diagnosis mortality %
16. Bar chart: top primary diagnoses by admissions
17. Bar chart: top APR DRGs by admissions
18. Sankey: admission type -> service -> ICU unit -> discharge disposition

### Section 3: Labs, Vitals & Infection

19. Multi-line: daily median creatinine by outcome
20. Multi-line: daily median lactate by outcome
21. Multi-line: daily median WBC by outcome
22. Heatmap: lab abnormality % by lab x outcome
23. Box plot: key lab distributions by outcome
24. Multi-line: heart rate / respiratory rate / SpO2 by ICU day
25. Heatmap: organism x antibiotic resistance %
26. Stacked bar: S / I / R mix by organism
27. Table: microbiology burden and resistance ranking

### Section 4: Utilization & Readmission

28. Funnel: discharges -> eligible -> 7d -> 30d readmission
29. Line chart: readmission rate over time
30. Bar chart: readmission by discharge location
31. Bar chart: readmission by service
32. Bar chart: infusion category exposure counts
33. Bar chart: infusion category mortality %
34. Scatter: diagnosis burden vs LOS from admission-grain dataset

### Section 5: Data Quality & Provenance

35. Table: source object counts and freshness
36. Bar chart: null rates on critical fields
37. Table: orphan or join-failure diagnostics
38. KPI row: latest observed dates across admissions, labs, micro, ICU, inputevents

## Recommended visual types

Use Superset visual types that match the question, not just what is easiest to configure.

- `big_number_total` for KPIs
- `echarts_timeseries_line` for trends
- `echarts_timeseries_bar` for ranked distributions
- `heatmap_v2` for severity/outcome and organism/antibiotic matrices
- `box_plot` for LOS and lab spread
- `table` / `pivot_table_v2` for benchmarks and DQ
- `sankey` for patient flow
- `scatter` for LOS vs diagnosis burden
- `treemap_v2` optionally for diagnosis hierarchy

## Dashboard conventions

- Every metric must declare its denominator in the subtitle.
- Every event-weighted chart should have a patient-weighted equivalent if interpretation risk is high.
- Readmission charts must distinguish:
  - percent of patients
  - percent of admissions
  - count of readmission events
- Titles should use clinical language, not internal table names.
- Add dashboard text blocks documenting:
  - cohort size
  - ICU-stay grain vs admission grain
  - caveats for repeated-measures data

## Refresh strategy

Recommended:

- raw exploratory virtual datasets for low-volume slices
- materialized views for heavy summary layers
- nightly refresh for v2 summary views

Materialize first:

- `icu_episode_fact`
- `admission_readmission_fact`
- `admission_diagnosis_summary`
- `lab_daily_summary`
- `micro_resistance_summary`
- `unit_daily_census`

## Priority implementation order

Phase 1:

- fix readmission denominator
- replace diagnosis bubble source with admission-grain view
- rebuild ICU LOS box plot from raw stay-grain source
- add native filters

Phase 2:

- add ICU overview section
- add severity/outcome section
- add discharge destination and service flow

Phase 3:

- add lab daily summaries
- add vitals trajectories
- add microbiology summary layer

Phase 4:

- add DQ/provenance section
- add benchmark tables
- add annotations and dashboard help text

## Success criteria

- no chart errors on first load
- every chart has an explicit denominator
- no chart built on the wrong grain
- all high-volume panels render in under 2 seconds from summary views
- dashboard supports clinical drill-down through native filters instead of separate one-off charts
