# Phase 19-02 Legacy GIS Table Audit

**Date:** 2026-04-27
**Auditor:** Phase 19 Plan 02 executor (worktree-agent-abf5638b8d08e1de9)
**Live DB introspection date:** 2026-04-26 (also re-verified post-Wave-1 deploy)
**Database:** `parthenon` on host PostgreSQL 17

## Pre-existing tables in `parthenon` DB (before Wave 1)

| Table                       | Created by migration                          | Row count | Status                    | Disposition       | Rationale |
|-----------------------------|------------------------------------------------|-----------|---------------------------|-------------------|-----------|
| `app.gis_boundary_levels`   | `2026_03_11_000002_create_gis_boundary_tables` | 0         | live (empty)              | KEEP              | Used by GADM admin-boundary import lineage; structurally orthogonal to gis.* schema. No conflict with Wave 1 changes. |
| `app.gis_admin_boundaries`  | `2026_03_11_000002_create_gis_boundary_tables` | MISSING   | not deployed (silent skip) | DEPRECATE         | The 2026_03_11_000002 migration's `postgisAvailable()` check ran before 2026_03_11_000001 enabled PostGIS — leading to the geometry column being skipped on some envs and the table itself never landing in the live `parthenon` DB (verified by `information_schema.tables` lookup 2026-04-26). Superseded by `gis.geographic_location` with a proper PostGIS column declared at table-creation time. Recreating this table would duplicate effort and conflict with the canonical Phase 19 schema. |
| `app.gis_datasets`          | `2026_03_11_000005_create_gis_datasets_table`  | 0         | live (empty)              | KEEP + EXTEND     | Catalog of GIS datasets. Now extended via `2026_04_27_000002_seed_gis_dataset_ua_county` to include the `census_ua_2020` row for Plan 03 to consume. |
| `app.gis_imports`           | `2026_03_12_000001_create_gis_imports_table`   | 0         | live (empty)              | KEEP              | Tracks per-import state for GADM/USGS imports. Orthogonal to the UA loader. No changes. |
| `app.external_exposure`     | `2026_03_11_000004_create_external_exposure_table` | 0         | live (empty, never written) | DEPRECATE (defer drop) | OMOP-CDM-shaped sidecar table with `exposure_concept_id`, `exposure_start_date`, `exposure_end_date`. Created in March 2026 but never populated by any loader. `gis.external_exposure` (created in `2026_04_27_000001`) is the canonical Phase 19+ exposures table — simpler shape (`exposure_type` + `value_as_*`), keyed by `(source_id, person_id)`, written by Plan 03's UPSERT loaders. **Drop in a follow-up cleanup phase** (post-19, post-Wave-5) to give the deprecation period time to surface any unknown consumers. |

## Disposition decisions (this plan)

| Table                       | Decision      | Action this plan                                                       |
|-----------------------------|---------------|------------------------------------------------------------------------|
| `app.gis_boundary_levels`   | KEEP          | None.                                                                  |
| `app.gis_admin_boundaries`  | DEPRECATE     | `2026_04_27_000003_audit_legacy_gis_admin_boundaries` is a no-op-with-log: detects absence and records the disposition in the application log and migrations table. NO destructive action. NO retroactive create. |
| `app.gis_datasets`          | KEEP + EXTEND | `2026_04_27_000002_seed_gis_dataset_ua_county` inserts the `census_ua_2020` row (slug-unique, idempotent). |
| `app.gis_imports`           | KEEP          | None.                                                                  |
| `app.external_exposure`     | DEPRECATE     | None this plan. Drop deferred to a post-Phase-19 cleanup task.         |

## What Wave 1 deployed

| Object                              | Type             | Provenance                                         |
|-------------------------------------|------------------|----------------------------------------------------|
| `gis` schema                        | SCHEMA           | `2026_04_27_000001_create_gis_schema_and_tables`   |
| `gis.geographic_location`           | TABLE            | `2026_04_27_000001` — UA county/tract/zip rows      |
| `gis.external_exposure`             | TABLE            | `2026_04_27_000001` — D-01 source_id FK + UNIQUE   |
| `gis.location_geography`            | TABLE            | `2026_04_27_000001` — per-source ZIP→tract→county  |
| `gis.gis_hospital`                  | TABLE            | `2026_04_27_000001` — hospital points              |
| `gis.geography_summary`             | TABLE            | `2026_04_27_000001` — pre-aggregated stats         |
| `gis.patient_geography`             | MATERIALIZED VIEW | `2026_04_27_000001` — empty stub (Plan 03 fills body) |
| `app.gis_datasets[slug='census_ua_2020']` | ROW         | `2026_04_27_000002` — UA dataset registration      |

## How verified (commands actually run on 2026-04-26 / 2026-04-27)

Step 1 — list every relevant table that exists post-Wave-1:

```bash
psql -h localhost -U claude_dev -d parthenon -c "
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE (table_schema = 'app' AND (table_name LIKE 'gis%' OR table_name = 'external_exposure'))
     OR table_schema = 'gis'
  ORDER BY table_schema, table_name;
"
```

Output (2026-04-27, post-Wave-1 deploy):

| table_schema | table_name           |
|--------------|----------------------|
| app          | external_exposure    |
| app          | gis_boundary_levels  |
| app          | gis_datasets         |
| app          | gis_imports          |
| gis          | external_exposure    |
| gis          | geographic_location  |
| gis          | geography_summary    |
| gis          | gis_hospital         |
| gis          | location_geography   |

(9 rows; gis.patient_geography is a matview, returned by `pg_matviews` instead — verified separately.)

Step 2 — count rows in each pre-existing table (commented out for tables that don't exist):

```bash
psql -h localhost -U claude_dev -d parthenon -tAc "SELECT 'app.gis_boundary_levels',  count(*) FROM app.gis_boundary_levels"
psql -h localhost -U claude_dev -d parthenon -tAc "SELECT 'app.gis_datasets',         count(*) FROM app.gis_datasets"
psql -h localhost -U claude_dev -d parthenon -tAc "SELECT 'app.gis_imports',          count(*) FROM app.gis_imports"
psql -h localhost -U claude_dev -d parthenon -tAc "SELECT 'app.external_exposure',    count(*) FROM app.external_exposure"
# psql -h localhost -U claude_dev -d parthenon -tAc "SELECT 'app.gis_admin_boundaries', count(*) FROM app.gis_admin_boundaries"  # MISSING — see audit
```

Output:

| Table                        | count(*) |
|------------------------------|----------|
| app.gis_boundary_levels      | 0        |
| app.gis_datasets             | 0 (pre-Wave-1) → 1 (post-2026_04_27_000002) |
| app.gis_imports              | 0        |
| app.external_exposure        | 0        |
| app.gis_admin_boundaries     | ERROR: relation "app.gis_admin_boundaries" does not exist |

Step 3 — verify gis schema posture post-Wave-1:

```bash
psql -h localhost -U claude_dev -d parthenon -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='gis'"             # → 5
psql -h localhost -U claude_dev -d parthenon -tAc \
  "SELECT count(*) FROM pg_matviews WHERE schemaname='gis'"           # → 1
psql -h localhost -U claude_dev -d parthenon -tAc \
  "SELECT has_schema_privilege('parthenon_app','gis','USAGE')"        # → t
psql -h localhost -U claude_dev -d parthenon -tAc \
  "SELECT has_schema_privilege('parthenon_app','gis','CREATE')"       # → f
psql -h localhost -U claude_dev -d parthenon -tAc \
  "SELECT has_table_privilege('parthenon_app','gis.external_exposure','TRUNCATE')"  # → f
```

## Forward-looking notes

- `app.external_exposure` and `app.gis_admin_boundaries` should be dropped together in a post-Phase-19 cleanup migration once Plan 04's stratification surface is live and we are confident no consumer depends on the OMOP-CDM-shaped sidecar.
- `app.gis_boundary_levels`, `app.gis_datasets`, `app.gis_imports` remain as the GADM/USGS import lineage and are orthogonal to the gis.* analytical surface. No retirement planned.
- The Wave 1 migration `2026_04_27_000003_audit_legacy_gis_admin_boundaries` records this audit in the migrations table so the disposition is permanent and queryable via `php artisan migrate:status`.

## Cross-references

- `19-RESEARCH.md` — Pitfall 1 (gis_admin_boundaries silent skip) provides the historical root-cause analysis.
- `19-02-PLAN.md` — Task 2 Step C / Step D specify this audit.
- `2026_04_27_000001_create_gis_schema_and_tables.php` — the migration that supersedes the missing `app.gis_admin_boundaries`.
- HIGHSEC §6 — least-privilege GRANT posture for the new gis schema is enforced and verified live (steps 3 above).
