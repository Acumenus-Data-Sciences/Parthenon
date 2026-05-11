# MIMIC-Style Inpatient Dataset Devlog

Date: 2026-03-20

Authoring context: this package was built directly inside the local Postgres database `zephyrus` from source schema `stage`.

## What was created

### SQL artifacts

- `mimic_stage.sql`
- `mimic_export.sql`
- `mimic_synth_labevents.sql`
- `mimic_synth_emar.sql`
- `mimic_synth_chartevents.sql`
- `mimic_package.sql`

### Documentation artifacts

- `MIMIC_EXPORT_DATA_DICTIONARY.md`
- `SYNTHETIC_AUGMENTATION_PLAN.md`
- `DEVLOG_MIMIC_INGEST_HANDOFF.md`

## Database schemas created

### `mimic_stage`

View-based derivation layer:
- `mimic_patients`
- `mimic_admissions`
- `mimic_transfers`
- `mimic_orders`
- `mimic_problem_list`

### `mimic_export`

Materialized observed tables:
- `mimic_patients`
- `mimic_admissions`
- `mimic_transfers`
- `mimic_orders`
- `mimic_problem_list`
- `dataset_metadata`

### `mimic_synth`

Materialized synthetic tables:
- `synthetic_labevents`
- `synthetic_emar`
- `synthetic_chartevents`
- `dataset_metadata`

### `mimic_final`

Packaged MIMIC-style interface:
- `patients`
- `admissions`
- `transfers`
- `orders`
- `problem_list`
- `labevents`
- `emar`
- `chartevents`
- `dataset_catalog`

## Current row counts

### Observed core

- `mimic_export.mimic_patients`: `3,112,420`
- `mimic_export.mimic_admissions`: `902,652`
- `mimic_export.mimic_transfers`: `7,124,300`
- `mimic_export.mimic_orders`: `28,006,618`
- `mimic_export.mimic_problem_list`: `1,465,802`

### Synthetic missing modalities

- `mimic_synth.synthetic_labevents`: `5,287,946`
- `mimic_synth.synthetic_emar`: `2,369,443`
- `mimic_synth.synthetic_chartevents`: `27,746,748`

### Packaged final views

- `mimic_final.patients`: `3,112,420`
- `mimic_final.admissions`: `902,652`
- `mimic_final.transfers`: `7,124,300`
- `mimic_final.orders`: `28,006,618`
- `mimic_final.problem_list`: `1,465,802`
- `mimic_final.labevents`: `5,287,946`
- `mimic_final.emar`: `2,369,443`
- `mimic_final.chartevents`: `27,746,748`

## Provenance rules

- `patients`, `admissions`, `transfers`, `orders`, and `problem_list` are observed-derived from Epic extract tables in `stage`
- `labevents`, `emar`, and `chartevents` are synthetic-only
- synthetic rows are intentionally kept out of `mimic_export`
- `mimic_final.dataset_catalog` records observed vs synthetic object provenance and counts
- packaged views expose `data_origin`

## Important limitations

### 1. Diagnoses are not MIMIC-quality

`mimic_export.mimic_problem_list` is patient-level problem list data, not a defensible encounter diagnosis fact table.

Important consequence:
- do not label this as true `diagnoses_icd`
- do not use it as if it were hospital billing diagnoses

### 2. Synthetic clinical event layers are synthetic

`mimic_synth.synthetic_labevents`, `mimic_synth.synthetic_emar`, and `mimic_synth.synthetic_chartevents` are generated from deterministic SQL heuristics and observed anchors.

Important consequence:
- suitable for pipeline prototyping, demos, experimentation, and benchmarking
- not suitable for clinical outcomes research or any claim about actual observed bedside events

### 3. `hadm_id` coverage is imperfect in admissions

Some source `hsp_account_id` values are the sentinel string `\N`.

Important consequence:
- those admissions do not get a derived `hadm_id`
- downstream ingestion must tolerate null `hadm_id` in some rows of the observed layer

### 4. `orders` is not a direct MIMIC table

`mimic_final.orders` is a pragmatic order-level layer built from `order_proc`, `cpoe_info`, and `order_status`.

Important consequence:
- treat it as source-supporting context, not as a canonical MIMIC fact table

## What the ingestion agent should do next

### 1. Use `mimic_final` as the ingest interface

Recommended ingestion targets:
- `mimic_final.patients`
- `mimic_final.admissions`
- `mimic_final.transfers`
- `mimic_final.orders`
- `mimic_final.problem_list`
- `mimic_final.labevents`
- `mimic_final.emar`
- `mimic_final.chartevents`

Do not ingest from `stage` directly unless you are intentionally revisiting the extraction logic.

### 2. Preserve provenance on ingest

Required:
- retain `data_origin`
- retain source identifiers such as `src_pat_id`, `src_pat_enc_csn_id`, `src_hsp_account_id`, `source_order_id`, `src_order_proc_id`, and `src_cpoe_order_id`

Rationale:
- future backfills against better Epic extracts will require row lineage
- observed vs synthetic separation must remain recoverable

### 3. Build ingestion assertions before loading downstream

Minimum checks:
- row counts match the counts listed above
- `mimic_final.labevents.data_origin = 'synthetic'` only
- `mimic_final.emar.data_origin = 'synthetic'` only
- `mimic_final.chartevents.data_origin = 'synthetic'` only
- `mimic_final.patients/admissions/transfers/orders/problem_list.data_origin = 'observed'` only
- `subject_id` exists for all packaged views
- `hadm_id` exists for the majority of admissions and event rows, but nulls are tolerated

### 4. Decide whether downstream naming should stay honest or imitate MIMIC literally

Two options:

Option A:
- preserve the current names and document that `problem_list` is not `diagnoses_icd`

Option B:
- create a downstream semantic layer that maps these into application-specific names instead of pretending they are native MIMIC tables

Recommendation:
- prefer Option B unless a strict MIMIC-shaped interface is mandatory

### 5. Plan the next backfill against Epic

Highest-value missing real source tables to request:
- encounter diagnosis or billing diagnosis facts
- component-level lab result facts
- MAR / medication administration facts
- flowsheet measurement facts
- ICU or unit-stay identifiers if available

If those are acquired, synthetic modules should be retired or demoted.

## Suggested ingestion order

1. ingest `patients`
2. ingest `admissions`
3. ingest `transfers`
4. ingest `orders`
5. ingest `problem_list` with caveat tags
6. ingest `labevents`
7. ingest `emar`
8. ingest `chartevents`

## Suggested downstream tags

Recommended metadata fields on every ingested dataset:
- `source_schema`
- `source_object`
- `data_origin`
- `generation_model`
- `generation_version`
- `ingested_at`

For observed tables, `generation_model` and `generation_version` can be null.

## Fast validation queries

Use these directly in Postgres after ingest work starts:

```sql
select * from mimic_final.dataset_catalog order by object_name;
```

```sql
select 'patients' as view_name, count(*) from mimic_final.patients
union all
select 'admissions', count(*) from mimic_final.admissions
union all
select 'transfers', count(*) from mimic_final.transfers
union all
select 'orders', count(*) from mimic_final.orders
union all
select 'problem_list', count(*) from mimic_final.problem_list
union all
select 'labevents', count(*) from mimic_final.labevents
union all
select 'emar', count(*) from mimic_final.emar
union all
select 'chartevents', count(*) from mimic_final.chartevents;
```

```sql
select data_origin, count(*) from mimic_final.labevents group by data_origin
union all
select data_origin, count(*) from mimic_final.emar group by data_origin
union all
select data_origin, count(*) from mimic_final.chartevents group by data_origin;
```

## Bottom line

This package is good enough for MIMIC-shaped ingestion and internal experimentation now.

It is not a faithful observational MIMIC-IV reproduction.

Treat the observed core as real, the event layers as synthetic, and keep provenance intact.
