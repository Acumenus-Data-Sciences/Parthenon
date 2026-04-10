# Superset MIMIC v2 Assets

Files:

- `create_mimic_v2_semantic_layer.sql`
- `refresh_mimic_v2_semantic_layer.sql`
- `mimic_v2_dashboard_spec.yaml`
- `generate_mimic_v2_dataset_bundle.py`
- `generate_mimic_v2_assets_bundle.py`
- `patch_mimic_v2_live_metadata.py`
- `mimic_v2_dashboard_build_sequence.md`

## Purpose

These assets convert the live `mimiciv` schema into a curated `superset_mimic` semantic layer for the `MIMIC-IV ICU Clinical Analytics` dashboard refresh.

The goal is to stop building charts directly from raw event tables and instead use stable admission-grain, stay-grain, and daily-summary layers.

## Apply the semantic layer

From the PostgreSQL container:

```bash
docker exec -i parthenon-postgres psql -U parthenon -d parthenon < scripts/superset/create_mimic_v2_semantic_layer.sql
```

To refresh after source reloads:

```bash
docker exec -i parthenon-postgres psql -U parthenon -d parthenon < scripts/superset/refresh_mimic_v2_semantic_layer.sql
```

## Register datasets in Superset

Generate the datasource bundle:

```bash
python3 scripts/superset/generate_mimic_v2_dataset_bundle.py
```

Import the generated ZIP into the running Superset container:

```bash
docker cp scripts/superset/generated/mimic_v2_dataset_bundle.zip acropolis-superset:/tmp/mimic_v2_dataset_bundle.zip
docker exec acropolis-superset sh -lc '/app/.venv/bin/superset import-datasources -p /tmp/mimic_v2_dataset_bundle.zip'
```

The bundle registers these datasets from schema `superset_mimic`:

- `icu_episode_fact`
- `admission_readmission_fact`
- `admission_diagnosis_summary`
- `lab_daily_summary`
- `vital_daily_summary`
- `micro_resistance_summary`
- `infusion_category_summary`
- `unit_daily_census`
- `discharge_outcome_summary`
- `data_quality_summary`

## Dashboard build order

1. Build KPI cards and overview charts from `icu_episode_fact` and `admission_readmission_fact`
2. Replace the existing readmission KPI with admission-level denominator
3. Replace the diagnosis bubble chart with `admission_diagnosis_summary`
4. Replace the ICU LOS box plot with raw `icu_episode_fact.icu_los_days`
5. Add native filters
6. Add labs, vitals, infection, and DQ sections

The chart-by-chart assembly order is in `mimic_v2_dashboard_build_sequence.md`.

Generate the full dashboard asset bundle:

```bash
python3 scripts/superset/generate_mimic_v2_assets_bundle.py
```

Import the generated asset directory into the running Superset container:

```bash
docker cp scripts/superset/generated/mimic_v2_assets_bundle acropolis-superset:/tmp/mimic_v2_assets_bundle
docker exec acropolis-superset sh -lc '/app/.venv/bin/superset import-directory -o /tmp/mimic_v2_assets_bundle/mimic_v2_assets_bundle'
```

The dashboard asset bundle intentionally excludes `databases/` so it cannot overwrite the live `Parthenon` SQLAlchemy URI during import.

On the live `superset.acumenus.net` instance, run the metadata patch step after import so each slice gets a valid `query_context` bound to the actual dataset IDs in that environment:

```bash
docker cp scripts/superset/generate_mimic_v2_assets_bundle.py acropolis-superset:/tmp/generate_mimic_v2_assets_bundle.py
docker cp scripts/superset/patch_mimic_v2_live_metadata.py acropolis-superset:/tmp/patch_mimic_v2_live_metadata.py
docker exec acropolis-superset sh -lc '/app/.venv/bin/python /tmp/patch_mimic_v2_live_metadata.py'
```

## Notes

- The live `mimiciv` schema stores nearly all fields as `text`, so the SQL layer casts defensively.
- Readmission metrics must always declare the denominator explicitly.
- Event-heavy domains like labs and microbiology should not be interpreted as patient prevalence unless re-aggregated first.

## Validation

The semantic-layer SQL was compile-checked on `2026-04-10` against the live `mimiciv` schema inside a single transaction and rolled back.

Observed materialized-view row counts during validation:

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

## Superset registration

The generated datasource bundle was imported into the live Superset instance on `2026-04-10`.

- `admission_diagnosis_summary`: dataset `17`
- `admission_readmission_fact`: dataset `18`
- `data_quality_summary`: dataset `19`
- `discharge_outcome_summary`: dataset `20`
- `icu_episode_fact`: dataset `21`
- `infusion_category_summary`: dataset `22`
- `lab_daily_summary`: dataset `23`
- `micro_resistance_summary`: dataset `24`
- `unit_daily_census`: dataset `25`
- `vital_daily_summary`: dataset `26`

## Live dashboard

The v2 dashboard asset bundle was imported into the live Superset instance on `2026-04-10`.

- Dashboard id: `4`
- Title: `MIMIC-IV ICU Clinical Analytics v2`
- Slug: `mimic-iv-icu-clinical-analytics-v2`
- Charts attached: `26`
- Native filters configured: `8`
