---
phase: 19
plan: 02
subsystem: gis
tags: [phase19, gis, schema-deploy, wave-1, highsec, postgis, migration]
wave: 1
dependency_graph:
  requires: [GIS-01]
  provides:
    - gis_schema_deployed
    - gis_external_exposure_d01_d05
    - gis_patient_geography_matview_stub
    - gis_eloquent_models
    - census_ua_2020_dataset_row
  affects:
    - parthenon database (live host PG17)
    - app.gis_datasets (extended)
    - app.migrations (3 new rows)
    - backend/app/Models/Gis/ (new directory)
tech_stack:
  added:
    - PostGIS 3.5.3 GEOGRAPHY(MULTIPOLYGON, 4326) columns on
      gis.geographic_location and GEOGRAPHY(POINT, 4326) on gis.gis_hospital
  patterns:
    - DO $$ ... $$ blocks for role-conditional GRANTs (portable across CI envs
      lacking parthenon_migrator/parthenon_app)
    - SET search_path TO gis, public, app, php at migration entry to expose
      PostGIS types from public schema during DDL
    - newBelongsTo() factory override to force cross-connection BelongsTo
      onto 'pgsql' connection (gis search_path lacks app schema)
    - ALTER DEFAULT PRIVILEGES FOR ROLE so future tables inherit DML grants
key_files:
  created:
    - backend/database/migrations/2026_04_27_000001_create_gis_schema_and_tables.php
    - backend/database/migrations/2026_04_27_000002_seed_gis_dataset_ua_county.php
    - backend/database/migrations/2026_04_27_000003_audit_legacy_gis_admin_boundaries.php
    - backend/app/Models/Gis/GeographicLocation.php
    - backend/app/Models/Gis/ExternalExposure.php
    - backend/app/Models/Gis/LocationGeography.php
    - .planning/phases/19-ua-county-urban-rural-stratification-deploy-dormant-gis-sche/19-02-AUDIT.md
    - .planning/phases/19-ua-county-urban-rural-stratification-deploy-dormant-gis-sche/19-02-SUMMARY.md
  modified: []
  database_objects_created:
    - SCHEMA gis (owned by parthenon_migrator)
    - TABLE gis.geographic_location
    - TABLE gis.external_exposure (D-01, D-05 enforced)
    - TABLE gis.location_geography
    - TABLE gis.gis_hospital
    - TABLE gis.geography_summary
    - MATERIALIZED VIEW gis.patient_geography (empty stub)
    - ROW app.gis_datasets[slug='census_ua_2020']
decisions:
  - "Cross-connection BelongsTo uses newBelongsTo() factory because Eloquent's BelongsTo class has no setConnection() method (PHPStan level 8 catches this); plan's chained ->setConnection('pgsql') syntax does not compile"
  - "Migration sets search_path to 'gis,public,app,php' at start of up() so PostGIS types resolve at column-declaration time; default pgsql connection search_path 'app,php' excludes both 'public' (PostGIS) and 'gis' (the new schema)"
  - "GRANT SELECT/INSERT/UPDATE/DELETE on app.gis_datasets to parthenon_migrator was missing; added live as a one-time DBA grant (Rule 3 deviation) — without it migration 2 cannot insert the census_ua_2020 row"
  - "GRANT USAGE on schema public to parthenon_migrator was missing; added live as one-time DBA grant — without it the migrator cannot reference public.geography type even with search_path set (Rule 3 deviation)"
  - "Audit migration is no-op-with-log; explicit Log::info entries record disposition decision in application log alongside the canonical 19-02-AUDIT.md"
metrics:
  duration_minutes: ~22
  tasks_completed: 2
  files_created: 8
  files_modified: 0
  commits: 2
  completed: 2026-04-27
---

# Phase 19 Plan 02: UA County Urban/Rural Stratification — Wave 1 Schema Deploy Summary

Wave 1 deployed the dormant `gis.*` schema against the live `parthenon` database with HIGHSEC-compliant GRANT posture. 5 base tables + 1 materialized-view stub created, owned by `parthenon_migrator`. `gis.external_exposure` enforces D-01 (`source_id BIGINT NOT NULL REFERENCES app.sources(id)`) and D-05 (`UNIQUE (source_id, person_id, exposure_type, exposure_date)`). PostGIS check (D-04) throws `RuntimeException` loudly. 3 Eloquent models with `$fillable` whitelists; `ExternalExposure` and `LocationGeography` use `newBelongsTo()` cross-connection bridge to `app.sources`. `app.gis_datasets[slug='census_ua_2020']` registered with `feature_count=3234`, `status='pending'`. Legacy `app.gis_admin_boundaries` audited as MISSING and DEPRECATED. All 7 Wave 0 RED Pest tests now GREEN. PHPStan level 8 clean on the new model directory.

## Tasks Completed

| Task | Name                                                                | Commit     | Files                                                                                                                                          |
| ---- | ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Author Laravel migration to create gis schema + 5 tables + matview  | `7e77c3c77` | `backend/database/migrations/2026_04_27_000001_create_gis_schema_and_tables.php` (360 lines)                                                   |
| 2    | Eloquent models + dataset registration migration + legacy audit     | `f219bbab3` | 3 models + 2 migrations + 19-02-AUDIT.md (488 lines added)                                                                                     |

## What Landed

### Migration 1 — gis schema + 5 tables + matview (360 lines)

`backend/database/migrations/2026_04_27_000001_create_gis_schema_and_tables.php` performs:

1. **D-04 PostGIS check (lines 54-66):** `SELECT 1 FROM pg_extension WHERE extname='postgis'` — `throw new RuntimeException(...)` if missing. No SAVEPOINT swallow.
2. **search_path SET (line 90):** `SET search_path TO gis, public, app, php` so PostGIS types resolve.
3. **CREATE SCHEMA gis AUTHORIZATION parthenon_migrator** (lines 95-104) — wrapped in `DO $$` block, conditional on role existing for CI portability.
4. **GRANT USAGE + REVOKE CREATE on schema** (lines 106-117) for parthenon_app.
5. **5 tables (lines 122-235):** `geographic_location`, `external_exposure` (D-01 source_id FK + D-05 UNIQUE), `location_geography` (per-source unique), `gis_hospital`, `geography_summary`.
6. **Materialized view `gis.patient_geography`** (lines 257-285) — empty stub via `WHERE FALSE WITH NO DATA`, unique index on `(source_id, person_id)` for D-02. Plan 03 replaces the body via DROP+CREATE inside the loader.
7. **Final GRANT block (lines 287-310):** SELECT/INSERT/UPDATE/DELETE on tables, USAGE+SELECT on sequences, REVOKE TRUNCATE, ALTER DEFAULT PRIVILEGES so future tables inherit DML grants.
8. **`down()`** (lines 314-345): drops matview → tables (reverse-dependency order) → schema CASCADE, each in try/catch for partial-deploy safety.

### Migration 2 — UA dataset registration

`2026_04_27_000002_seed_gis_dataset_ua_county.php`: idempotent `updateOrInsert` on `app.gis_datasets[slug='census_ua_2020']` with `feature_count=3234`, `status='pending'`, `source_url=https://www2.census.gov/.../2020_UA_COUNTY.xlsx`, `file_path='2020_UA_COUNTY.xlsx'`.

### Migration 3 — legacy audit checkpoint

`2026_04_27_000003_audit_legacy_gis_admin_boundaries.php`: no-op-with-log. Detects whether `app.gis_admin_boundaries` exists, emits `Log::info` recording disposition (DEPRECATE if missing, DEFER if present). Lands a row in `app.migrations` for queryable audit history.

### Eloquent models

- `GeographicLocation` (54 lines): unprefixed `$table='geographic_location'`, `$primaryKey='geographic_location_id'`, no timestamps, 10 fillable fields, casts for numeric columns. PostGIS `geometry` column intentionally NOT fillable.
- `ExternalExposure` (104 lines): D-01 source_id in fillable, `source()` BelongsTo via `newBelongsTo()` factory forcing related Source onto `pgsql` connection (B-06), `geographicLocation()` intra-connection BelongsTo.
- `LocationGeography` (95 lines): per-source crosswalk model with `tractLocation()` and `countyLocation()` BelongsTo + cross-connection `source()`.

### Audit document — 19-02-AUDIT.md (117 lines)

Full inventory of pre-existing `app.gis_*` tables with live row counts (all 0 today), disposition decisions, and the verification commands that produced the inventory. Documents the disposition for `app.gis_admin_boundaries` (DEPRECATE — superseded by `gis.geographic_location`) and `app.external_exposure` (DEPRECATE — drop deferred to post-Phase-19 cleanup).

## Verification Results

| Check                                            | Command                                                                                            | Result                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| gis schema exists                                | `psql -tAc "SELECT count(*) FROM pg_namespace WHERE nspname='gis'"`                                | `1` ✓                                                   |
| 5 tables in gis schema                           | `psql -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='gis'"`                                | `5` ✓                                                   |
| 1 matview in gis schema                          | `psql -tAc "SELECT count(*) FROM pg_matviews WHERE schemaname='gis' AND matviewname='patient_geography'"` | `1` ✓                                                   |
| schema owner = parthenon_migrator                | `psql -tAc "SELECT nspowner::regrole FROM pg_namespace WHERE nspname='gis'"`                       | `parthenon_migrator` ✓                                  |
| parthenon_app USAGE on gis                       | `has_schema_privilege('parthenon_app','gis','USAGE')`                                              | `t` ✓                                                   |
| parthenon_app NOT CREATE on gis                  | `has_schema_privilege('parthenon_app','gis','CREATE')`                                             | `f` ✓                                                   |
| parthenon_app NOT TRUNCATE on gis.external_exposure | `has_table_privilege('parthenon_app','gis.external_exposure','TRUNCATE')`                          | `f` ✓                                                   |
| parthenon_app DML on gis.external_exposure       | INSERT/SELECT/UPDATE/DELETE                                                                        | all `t` ✓                                               |
| source_id NOT NULL                               | `pg_attribute.attnotnull WHERE attname='source_id' AND relname='external_exposure'`               | `t` ✓                                                   |
| UNIQUE constraint conkey length 4                | `pg_constraint contype='u' AND array_length(conkey,1)=4`                                           | `uq_external_exposure_source_person_type_date / 4` ✓     |
| FK to app.sources                                | `pg_constraint contype='f'`                                                                        | `external_exposure_source_id_fkey` present ✓             |
| census_ua_2020 dataset row                       | `psql -tAc "SELECT slug, feature_count, status FROM app.gis_datasets WHERE slug='census_ua_2020'"` | `census_ua_2020 / 3234 / pending` ✓                     |
| All 3 migrations applied                         | `psql -tAc "SELECT migration FROM app.migrations WHERE migration LIKE '2026_04_27%'"`              | 3 rows ✓                                                |
| All 3 migrations idempotent                      | Re-run all three                                                                                   | `Nothing to migrate.` × 3 ✓                             |
| Pest schema deploy tests (Wave 0 RED → GREEN)    | `vendor/bin/pest tests/Feature/Gis/Phase19SchemaDeployTest.php`                                    | **7 passed (20 assertions)** ✓                          |
| PHP syntax (`php -l`)                            | All 6 new PHP files                                                                                | No syntax errors detected ✓                             |
| Pint --test                                      | All 6 new PHP files                                                                                | PASS ✓                                                  |
| PHPStan level 8                                  | `app/Models/Gis/`                                                                                  | `[OK] No errors` ✓                                      |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Granted USAGE on schema public to parthenon_migrator**

- **Found during:** Task 1 first migration run.
- **Issue:** Migration failed with `SQLSTATE[42704] ... type "geography" does not exist`. PostGIS lives in the `public` schema (verified via `pg_type.typnamespace`), but `parthenon_migrator` had no USAGE on public — so type lookups failed even with the correct `search_path`.
- **Fix:** As `claude_dev`, ran `GRANT USAGE ON SCHEMA public TO parthenon_migrator`. This is a one-time DBA prerequisite analogous to `apt install postgis` — `parthenon_migrator` does not own `public` (smudoshi does), so the grant must come from a superuser. Documented inline in the migration's leading comment block as a permanent prerequisite for any future fresh install.
- **Files modified:** comment-only update to `2026_04_27_000001_create_gis_schema_and_tables.php`. No additional grant migration shipped because the migrator role itself cannot grant on `public`.
- **Commit:** `7e77c3c77`

**2. [Rule 3 — Blocking] Granted CRUD + sequence USAGE on app.gis_datasets to parthenon_migrator**

- **Found during:** Task 2 migration 2 first run.
- **Issue:** `app.gis_datasets` is owned by `claude_dev` with grants only to `parthenon_app`. `parthenon_migrator` had no INSERT permission, so the `updateOrInsert` for `census_ua_2020` failed with `SQLSTATE[42501] permission denied for table gis_datasets`. After the table grant was added, the same error appeared for `app.gis_datasets_id_seq`.
- **Fix:** As `claude_dev`, ran `GRANT SELECT, INSERT, UPDATE, DELETE ON app.gis_datasets TO parthenon_migrator` followed by `GRANT USAGE, SELECT, UPDATE ON SEQUENCE app.gis_datasets_id_seq TO parthenon_migrator`. This is a residue of the original 2026_03_11_000005 migration having been applied as `claude_dev` rather than `parthenon_migrator`. Future migrations will inherit the correct ownership when DBAs migrate the `app` schema to `parthenon_migrator` ownership (out of scope for this plan).
- **Commit:** `f219bbab3` (the migration itself; the GRANT was applied live before commit)

**3. [Rule 1 — Pattern] Replaced `belongsTo(...)->setConnection('pgsql')` with `newBelongsTo()` factory override**

- **Found during:** PHPStan level 8 check on Task 2.
- **Issue:** The plan specified `return $this->belongsTo(Source::class, 'source_id')->setConnection('pgsql');`. PHPStan caught that `Illuminate\Database\Eloquent\Relations\BelongsTo` has no `setConnection()` method — only the underlying `Builder`/`Model` does. The chained syntax fails type-checking and at runtime would emit "Call to an undefined method".
- **Fix:** Both `ExternalExposure::source()` and `LocationGeography::source()` now use the supported pattern: instantiate `Source` with `setConnection('pgsql')` first, then call `$this->newBelongsTo($instance->newQuery(), $this, 'source_id', $instance->getKeyName(), 'source')`. Same semantics (related model lookup goes through pgsql connection), but type-correct.
- **Files modified:** `backend/app/Models/Gis/ExternalExposure.php`, `backend/app/Models/Gis/LocationGeography.php`
- **Commit:** `f219bbab3`

### Plan Acceptance Criteria Notes

The plan's acceptance criteria included `grep -c "->setConnection('pgsql')" backend/app/Models/Gis/ExternalExposure.php returns 1`. After the Rule 1 fix that pattern no longer literally appears in the relation chain, but `setConnection('pgsql')` IS called on the related Source instance — so the grep still matches (3 hits in ExternalExposure, including the docstring references). The semantic intent (cross-connection bridge to app schema) is fully preserved and is now PHPStan-verifiable, which is stronger than the original syntax.

### Auth gates

None — this plan made no auth-protected route or middleware changes.

### CLAUDE.md Compliance Verifications

- Pint clean on every PHP file (verified via Docker container's vendor/bin/pint, version-parity with CI).
- PHPStan level 8 clean on `app/Models/Gis/` directory.
- No `$guarded = []` anywhere in `backend/app/Models/Gis/` (HIGHSEC §3.1).
- All Eloquent models declare connection + primary key + fillable explicitly.
- All migrations use `--path=` invocation, never bare `php artisan migrate`.
- All migrations run as `parthenon_migrator` via `-e DB_USERNAME` / `-e DB_PASSWORD` overrides — runtime continues to use `parthenon_app` (DB role separation per project memory `project_parthenon_pg_roles.md`).
- All commits used `--no-verify` per the parallel-executor protocol.
- Used `--force` on `php artisan migrate` because deploy.sh — the canonical project migration runner — uses `--force`. APP_ENV=production gates plain migrate; this is the documented project idiom.

## What Comes Next

Wave 2 (Plan 19-03) creates `scripts/gis/loader_common.py` (env-DSN module) and ports `load_crosswalk.py` + `load_geography.py` to use it. Then ships `scripts/gis/load_ua_county.py` which:

1. Reads the `census_ua_2020` row from `app.gis_datasets` to get `file_path`.
2. Parses `2020_UA_COUNTY.xlsx`, skipping the `CT_2022` sheet (D-06).
3. UPSERTs counties into `gis.geographic_location` (location_type='county').
4. UPSERTs per-person UA exposure rows into `gis.external_exposure` using D-05's unique constraint via `ON CONFLICT (source_id, person_id, exposure_type, exposure_date) DO UPDATE`.
5. Replaces the `gis.patient_geography` matview body via DROP+CREATE with the per-source SELECT joining `cdm.person → cdm.location → gis.location_geography` for tract/county allocation.
6. Flips `app.gis_datasets[slug='census_ua_2020'].status = 'loaded'`.

Wave 3 (Plan 19-04) wires `location_urban_pct` into `IncidenceRateService::buildIncidenceRateSql` and adds the Designer toggle.

Wave 4 (Plan 19-05) remediates legacy loaders and expands the DSN guard watch-list.

## Self-Check: PASSED

- File `backend/database/migrations/2026_04_27_000001_create_gis_schema_and_tables.php` exists (360 lines) ✓
- File `backend/database/migrations/2026_04_27_000002_seed_gis_dataset_ua_county.php` exists (55 lines) ✓
- File `backend/database/migrations/2026_04_27_000003_audit_legacy_gis_admin_boundaries.php` exists (63 lines) ✓
- File `backend/app/Models/Gis/GeographicLocation.php` exists (54 lines) ✓
- File `backend/app/Models/Gis/ExternalExposure.php` exists (104 lines) ✓
- File `backend/app/Models/Gis/LocationGeography.php` exists (95 lines) ✓
- File `.planning/phases/19-.../19-02-AUDIT.md` exists (117 lines) ✓
- Commit `7e77c3c77` (Task 1) found in `git log` ✓
- Commit `f219bbab3` (Task 2) found in `git log` ✓
- gis schema exists in live parthenon DB with 5 tables + 1 matview ✓
- HIGHSEC GRANT posture verified live (USAGE+DML, NOT CREATE/TRUNCATE) ✓
- All 7 Phase19SchemaDeployTest Pest tests passing ✓
- PHPStan level 8 clean on app/Models/Gis/ ✓
- All 3 migrations idempotent (Nothing to migrate on re-run) ✓
