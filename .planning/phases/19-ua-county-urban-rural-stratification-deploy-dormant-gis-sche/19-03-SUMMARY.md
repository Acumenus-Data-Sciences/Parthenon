---
phase: 19
plan: 03
subsystem: gis
tags: [phase19, gis, etl, loader, env-dsn, upsert, wave-2, panel-reconciliation]
wave: 2
dependency_graph:
  requires:
    - GIS-01            # Plan 02 — gis schema + 5 tables + matview stub
    - census_ua_2020 row in app.gis_datasets (Plan 02 Migration 2)
  provides:
    - GIS-02            # nationwide multi-source loaders + UPSERT idempotency
    - phase19_loader_common
    - gis_external_exposure_populated
    - gis_patient_geography_matview_built
    - app_gis_imports_cli_loader_rows
  affects:
    - parthenon database (live host PG17)
    - gis.geographic_location (3,234 county rows)
    - gis.location_geography (14,401 multi-source crosswalk rows)
    - gis.patient_geography matview (416,738 rows; built via DROP+CREATE)
    - gis.external_exposure (2,083,690 UA exposure rows)
    - app.gis_datasets[slug='census_ua_2020'].status (pending → loaded)
    - app.gis_imports (3 cli_loader rows for panel reconciliation)
tech_stack:
  added:
    - GisImportTracker class for app.gis_imports panel reconciliation
    - env-driven psycopg2 DSN (libpq PGPASSFILE / ~/.pgpass resolution)
    - DISTINCT ON (source_id, person_id) dedup for HUD multi-allocation tracts (Pitfall 4)
    - VACUUM ANALYZE via autocommit toggle (W-02 — VACUUM cannot run in xact)
  patterns:
    - sys.path bootstrap in each runnable loader so `python scripts/gis/X.py`
      works without PYTHONPATH
    - per-source DELETE + UPSERT for location_geography (matches RUCC-style
      idempotency without WAL doubling on UA's 2 M+ external_exposure rows)
    - GisImportTracker.fail() rolls back any poisoned PG transaction (SQLSTATE
      25P02) before recording the failure record
    - structured emit() JSON-on-stdout for traceability (no per-person details)
key_files:
  created:
    - scripts/gis/__init__.py
    - scripts/gis/loader_common.py
    - scripts/gis/load_ua_county.py
    - scripts/gis/env.example
    - scripts/gis/README.md
  modified:
    - scripts/gis/load_geography.py (full rewrite — nationwide counties)
    - scripts/gis/load_crosswalk.py (full rewrite — multi-source + matview)
    - scripts/gis/tests/conftest.py (PHASE_19_UA_XLSX_PATH env override)
    - scripts/gis/tests/test_dsn_no_legacy_credentials.py (watch-list 2 → 4)
decisions:
  - "POPPCT_URB / POPPCT_RUR / ALAND_PCT_URB are already stored as fractions
     in [0,1] in the source xlsx (verified live: DC=1.0, rural WY counties≈0.0,
     row sums to 1.0 within float tolerance). Plan said divisor=100; loader
     uses divisor=1.0 to keep the published fractions intact (Rule 1 bug fix)."
  - "patient_geography matview body uses DISTINCT ON (source_id, person_id)
     ORDER BY tract_allocation_ratio DESC NULLS LAST to deduplicate persons
     whose ZIP straddles multiple tracts (Pitfall 4 strategy 1, max-RES_RATIO).
     Without the dedup the unique index on (source_id, person_id) fails."
  - "Each per-source UNION ALL part is wrapped in parentheses so the inner
     ORDER BY (required by DISTINCT ON) doesn't bleed into the outer parser."
  - "Loaders use parthenon_migrator (not parthenon_app) because the matview
     rebuild is DDL-class (DROP + CREATE), and parthenon_app intentionally
     lacks CREATE on the gis schema per Plan 02 GRANT posture."
  - "GisImportTracker rows are stable on (filename, import_mode='cli_loader')
     so re-runs UPDATE in place rather than fragmenting the panel history view."
metrics:
  duration_minutes: ~14
  tasks_completed: 3
  files_created: 5
  files_modified: 4
  total_lines_added: ~1450
  commits: 3
  completed: 2026-04-27
---

# Phase 19 Plan 03: UA County Urban/Rural Stratification — Wave 2 Loaders Summary

Wave 2 ports the GIS Python loaders to env-driven nationwide multi-source operation, ships a new `loader_common.py` shared module, ships the new `load_ua_county.py` loader, and rebuilds `gis.patient_geography` as the shared `(source_id, person_id)` matview. All 12 Plan 01 RED pytest stubs are now GREEN (6 UA-county + 2 crosswalk + 4 DSN regression guard). The live `parthenon` database now holds 3,234 nationwide counties, 14,401 per-source ZIP-tract crosswalk rows, 416,738 patient-geography rows, and 2,083,690 UA exposure rows across 5 `exposure_type` variants. `app.gis_datasets[slug='census_ua_2020'].status` is now `loaded`, and three `app.gis_imports` rows reconcile the CLI loader runs into the existing GIS Import panel history.

## Tasks Completed

| Task | Name                                                                             | Commit       | Files                                                                                                                    |
| ---- | -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1    | loader_common env-DSN module + GisImportTracker + env.example + DSN watch-list  | `bfd2ffd41` | `scripts/gis/loader_common.py`, `scripts/gis/__init__.py`, `scripts/gis/env.example`, `scripts/gis/tests/test_dsn_no_legacy_credentials.py` |
| 2    | Nationwide multi-source load_geography + load_crosswalk + matview rebuild       | `23fe98b7d` | `scripts/gis/load_geography.py`, `scripts/gis/load_crosswalk.py`, `scripts/gis/loader_common.py`                         |
| 3    | UA county loader + README + conftest env override                                | `425d5ae75` | `scripts/gis/load_ua_county.py`, `scripts/gis/README.md`, `scripts/gis/tests/conftest.py`                                |

## What Landed

### `scripts/gis/loader_common.py` (396 lines)

Shared infrastructure module — single source of truth for env-driven DB access, the real-geography source allow-list (D-07), and the UPSERT template (D-05). Exposes:

- `get_dsn()` — builds libpq DSN from `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER`. Password resolves via `PGPASSFILE` / `~/.pgpass`. Defaults are parthenon-friendly (`localhost:5432`, `parthenon`, `parthenon_migrator`).
- `REAL_GEOGRAPHY_SOURCES = ["omop", "pancreas", "irsf"]` — D-07 canonical allow-list. Synthetic-zip CDMs (`synpuf`, `eunomia`) and raw schemas (`mimiciv`, `atlantic_health`) are excluded.
- `iter_real_geography_sources(conn=None)` — yields `SourceDescriptor` dicts for every real-geography source. Joins `app.sources` to `app.source_daimons` filtered to `daimon_type='cdm'` (lowercase per `DaimonType::CDM` backing value, B-02) and `s.source_key` (canonical column name, B-01). Each descriptor exposes both `source_key` (canonical) and `source_code` (alias) so the Plan 01 test surface continues to work without modification. The function may be called with a pre-opened connection (production loaders) or with no args (Wave 0 test stub) — in the no-arg case it opens its own short-lived connection.
- `UPSERT_SQL_external_exposure` — D-05 INSERT...ON CONFLICT (source_id, person_id, exposure_type, exposure_date) DO UPDATE template, imported by every UA-style loader.
- `GisImportTracker` — class encapsulating the panel reconciliation contract: one stable `app.gis_imports` row per `(filename, import_mode='cli_loader')`. Methods: `start()`, `update_progress(pct, log_line)`, `complete(row_count, summary_snapshot)`, `fail(exc)`. The `fail()` method rolls back any poisoned PG transaction (SQLSTATE 25P02) before writing the failure record so a transaction error during the loader doesn't cascade into a second error during error recording.
- `emit()` — structured JSON-on-stdout helper for trace-friendly aggregate logs (no per-person identifiers per T-19-13).
- `open_conn(autocommit=False)` — psycopg2 connection helper.

### `scripts/gis/load_geography.py` (rewritten, 255 lines)

Reads the main `2020_UA_COUNTY` sheet (D-06: skips `CT_2022`) for the FIPS source-of-truth and inserts one row per US county into `gis.geographic_location` (3,234 nationwide). State FIPS → state name lookup table covers the 56 codes that appear in the xlsx (50 states + DC + 5 territories). Geometry is OPTIONAL: if `PHASE_19_TIGER_COUNTY_SHP` is set and `geopandas` is importable, the loader fills the PostGIS `geometry` column from the TIGER shapefile; otherwise rows insert with `geometry=NULL` and choropleth rendering degrades to non-spatial table. Idempotent via `INSERT ... ON CONFLICT (geographic_code, location_type) DO UPDATE`. Reports progress through `GisImportTracker` with filename `2020_UA_COUNTY.xlsx#counties` so it doesn't collide with the Task 3 UA-exposure run.

### `scripts/gis/load_crosswalk.py` (rewritten, 290 lines)

Iterates real-geography sources via `iter_real_geography_sources`. For each source: clears that source's existing `gis.location_geography` rows, reads `<schema>.location` for ZIP-bearing rows, joins to the nationwide HUD `TRACT_ZIP_032020` crosswalk (172,121 rows), and writes `(source_id, location_id, zip_code, tract_fips, county_fips, tract_allocation_ratio, tract_location_id, county_location_id)` into `gis.location_geography` via UPSERT on `(source_id, location_id, tract_fips)`.

After all sources are loaded, the loader DROP+CREATEs the shared `gis.patient_geography` matview with a runtime-discovered UNION ALL across the real-geography sources. Each per-source SELECT uses `DISTINCT ON (source_id, person_id) ORDER BY tract_allocation_ratio DESC NULLS LAST` to deduplicate persons whose ZIP straddles multiple tracts (Pitfall 4 strategy 1 — pick the highest-allocation tract). Without that dedup, the post-CREATE `CREATE UNIQUE INDEX idx_pg_source_person ON gis.patient_geography(source_id, person_id)` would fail.

W-01 fix: DROP MATERIALIZED VIEW wipes the GRANT issued by Plan 02. The loader explicitly re-issues `GRANT SELECT ON gis.patient_geography TO parthenon_app` after the CREATE so runtime services keep their read access.

### `scripts/gis/load_ua_county.py` (314 lines)

The flagship UA loader. Reads the main `2020_UA_COUNTY` sheet (D-06), builds a `{fips5: {urban_pct, rural_pct, urban_pop_density, rural_pop_density, aland_pct_urban}}` lookup, then for each real-geography source joins `gis.patient_geography` (filtered to that source) to the UA lookup and emits 5 exposure rows per matched person:

| `exposure_type` | xlsx column | `unit`           | publication scale |
|-----------------|-------------|------------------|-------------------|
| `urban_pct`         | POPPCT_URB    | `fraction`        | already 0..1   |
| `rural_pct`         | POPPCT_RUR    | `fraction`        | already 0..1   |
| `urban_pop_density` | POPDEN_URB    | `people_per_sqmi` | density        |
| `rural_pop_density` | POPDEN_RUR    | `people_per_sqmi` | density        |
| `aland_pct_urban`   | ALAND_PCT_URB | `fraction`        | already 0..1   |

UPSERTs via `UPSERT_SQL_external_exposure` from `loader_common`. D-08: pancreas rows are tagged `source_dataset='census_ua_2020:pancreas:limited_geography'` so the Studies UI can warn researchers about the 4-zip Philadelphia care-site coverage. Synthetic sources are excluded by inheritance from the D-07 allow-list.

After load, the loader runs `VACUUM ANALYZE gis.external_exposure`. VACUUM cannot run inside a transaction (W-02), so the loader temporarily flips `conn.autocommit = True` for that one statement and restores the previous setting. Finally flips `app.gis_datasets[slug='census_ua_2020'].status = 'loaded'`.

### `scripts/gis/env.example` (35 lines)

Documents `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER=parthenon_migrator`, `PARTHENON_LOADER_USER_ID=117` for the GisImportTracker user_id stamp, and the data file path overrides. Explicitly does NOT include `PGPASSWORD` — the comment block instructs `~/.pgpass` (mode 600) for the password.

### `scripts/gis/README.md` (162 lines)

Phase 19 runbook: setup, run order, verification SQL, idempotency notes, decision references (D-04..D-08), legacy loader inventory.

### Test infrastructure changes

- `scripts/gis/tests/test_dsn_no_legacy_credentials.py`: watch-list expanded from 2 → 4 (added `load_crosswalk.py`, `load_geography.py` now that they're env-DSN compliant). Plan 05 will further expand to legacy loaders.
- `scripts/gis/tests/conftest.py`: `ua_xlsx_path` fixture now honours `PHASE_19_UA_XLSX_PATH` env var first before falling back to the repo-relative path. This lets worktree-based executors point at the canonical 10 MB xlsx in the main repo without duplicating it.
- `scripts/gis/__init__.py`: empty package marker so `from scripts.gis.loader_common import ...` resolves when pytest runs from the repo root.

## Verification Results

### pytest

```
$ python -m pytest scripts/gis/tests/ -v
============================= 12 passed in 30.41s ==============================

scripts/gis/tests/test_dsn_no_legacy_credentials.py::...[load_ua_county.py]    PASSED
scripts/gis/tests/test_dsn_no_legacy_credentials.py::...[loader_common.py]     PASSED
scripts/gis/tests/test_dsn_no_legacy_credentials.py::...[load_crosswalk.py]    PASSED
scripts/gis/tests/test_dsn_no_legacy_credentials.py::...[load_geography.py]    PASSED
scripts/gis/tests/test_load_crosswalk_multi_source.py::test_per_source_loop    PASSED
scripts/gis/tests/test_load_crosswalk_multi_source.py::test_get_dsn_env        PASSED
scripts/gis/tests/test_load_ua_county.py::test_parses_main_sheet               PASSED
scripts/gis/tests/test_load_ua_county.py::test_fips_concat                     PASSED
scripts/gis/tests/test_load_ua_county.py::test_skips_ct_2022                   PASSED
scripts/gis/tests/test_load_ua_county.py::test_excludes_synthetic_sources      PASSED
scripts/gis/tests/test_load_ua_county.py::test_get_dsn_uses_env                PASSED
scripts/gis/tests/test_load_ua_county.py::test_upsert_idempotency_marker       PASSED
```

### Live database verification

```
=== gis.geographic_location counties ===
SELECT count(*) FROM gis.geographic_location WHERE location_type='county'
→ 3234

=== gis.location_geography per source ===
 source_id | rows
-----------+------
        47 | 7180   -- ACUMENUS / omop
        57 | 7180   -- IRSF-NHS / irsf
        58 |   41   -- PANCREAS / pancreas (4-zip Philadelphia care sites)

=== gis.patient_geography matview ===
 source_id | rows   | persons | with_county
-----------+--------+---------+-------------
        47 | 416514 |  416514 |  416514       -- 41% of omop's 1 M persons
        58 |    224 |     224 |     224       -- pancreas (limited geography)
                              -- irsf rows = 0 because irsf.person.location_id IS NULL
                              -- (documented in 19-RESEARCH.md A1)
TOTAL = 416,738

=== gis.external_exposure (5 exposure_types × 416,738 persons) ===
 exposure_type     | count
-------------------+--------
 aland_pct_urban   | 416738
 rural_pct         | 416738
 rural_pop_density | 416738
 urban_pct         | 416738
 urban_pop_density | 416738
TOTAL = 2,083,690

=== Synthetic sources excluded (D-07) ===
SELECT count(*) FROM gis.external_exposure
WHERE source_id IN (SELECT id FROM app.sources WHERE source_key IN ('SYNPUF','EUNOMIA'))
→ 0

=== Pancreas tagged limited_geography (D-08) ===
SELECT DISTINCT source_dataset FROM gis.external_exposure WHERE source_id=58
→ census_ua_2020:pancreas:limited_geography

=== app.gis_datasets status flipped ===
SELECT slug, status FROM app.gis_datasets WHERE slug='census_ua_2020'
→ census_ua_2020 | loaded

=== app.gis_imports panel reconciliation ===
 id |           filename           | import_mode |  status   | row_count |      slug
----+------------------------------+-------------+-----------+-----------+----------------
  4 | 2020_UA_COUNTY.xlsx          | cli_loader  | completed |   2083690 | census_ua_2020
  3 | TRACT_ZIP_032020.xlsx        | cli_loader  | completed |     14401 | census_ua_2020
  2 | 2020_UA_COUNTY.xlsx#counties | cli_loader  | completed |      3234 | census_ua_2020
```

### Idempotency

All three loaders re-run successfully against the same database with no duplicate-key errors and identical row counts:

| Loader | Run 1 row_count | Run 2 row_count |
|--------|-----------------|-----------------|
| `load_geography.py`     | 3,234     | 3,234     |
| `load_crosswalk.py`     | 14,401    | 14,401    |
| `load_ua_county.py`     | 2,083,690 | 2,083,690 |

### Static checks

| Check | File | Result |
|-------|------|--------|
| `python -m py_compile` | all 4 loaders + loader_common | OK |
| Forbidden literal grep | all 4 watch-list files | 0 matches each |
| `from scripts.gis.loader_common import ...` | load_geography, load_crosswalk, load_ua_county | resolves |
| `iter_real_geography_sources` import | load_crosswalk | yields 3 descriptors |
| `CREATE MATERIALIZED VIEW gis.patient_geography` | load_crosswalk | 1 occurrence |
| `CREATE UNIQUE INDEX idx_pg_source_person` | load_crosswalk | 1 occurrence |
| `GRANT SELECT ON gis.patient_geography TO parthenon_app` | load_crosswalk | 1 occurrence (W-01) |
| `VACUUM ANALYZE gis.external_exposure` | load_ua_county | 1 occurrence (run cmd) |
| `conn.autocommit = True` | load_ua_county | 1 occurrence (W-02) |
| `pancreas:limited_geography` | load_ua_county | 1 occurrence (D-08) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] POPPCT_URB / POPPCT_RUR / ALAND_PCT_URB are already fractions, not percents**

- **Found during:** Task 3 — verifying expected output ranges before live load.
- **Issue:** The plan's `EXPOSURE_COLUMNS` table specified `divisor=100.0` for the three percent columns, with the comment `POPPCT_URB / 100 → 0..1`. Live inspection of `2020_UA_COUNTY.xlsx` plus the `FieldDescriptions_Notes` sheet shows the values are *already* stored as fractions in [0, 1] (DC has POPPCT_URB=1.0; rural Wyoming counties show ≈0.0; the row-wise sum POPPCT_URB + POPPCT_RUR ≈ 1.0 ± 0.025). Dividing by 100 would have produced exposure values in [0, 0.01], distorting every downstream stratification by 100×.
- **Fix:** All five `EXPOSURE_COLUMNS` entries use `divisor=1.0` and the loader passes the published value through unchanged. The spec is also revised in the docstring with a citation to the FieldDescriptions sheet. Plan 04's Studies stratification thresholds (0.25 / 0.50 / 0.75 from the RESEARCH.md Pattern 3) correctly assume [0, 1] input, so this fix aligns the loader with the downstream consumer.
- **Files modified:** `scripts/gis/load_ua_county.py`
- **Commit:** `425d5ae75`

**2. [Rule 1 — Bug] HUD multi-allocation tracts violated patient_geography unique index**

- **Found during:** Task 2 first live run — `psycopg2.errors.UniqueViolation: could not create unique index "idx_pg_source_person"; Key (source_id, person_id)=(47, 1) is duplicated.`
- **Issue:** The plan's matview UNION ALL pattern joined `<schema>.person → <schema>.location → gis.location_geography`. A single ZIP that crosses multiple census tracts emits multiple `gis.location_geography` rows (one per tract with its `tract_allocation_ratio`), so a single person joined to 4–11 tract rows. The post-CREATE unique index on `(source_id, person_id)` then failed because (47, person_id=1) appeared multiple times. RESEARCH.md Pitfall 4 documents the underlying cause (HUD's address-based RES_RATIO methodology produces multi-tract ZIPs) but didn't propagate the fix into the matview SQL spec.
- **Fix:** Each per-source UNION part now uses `SELECT DISTINCT ON (source_id, person_id) ... ORDER BY ..., lg.tract_allocation_ratio DESC NULLS LAST, lg.tract_fips` (Pitfall 4 strategy 1 — max-RES_RATIO). Each part is wrapped in parentheses so the inner ORDER BY (required by DISTINCT ON) doesn't bleed into the outer UNION ALL parser. county_fips is invariant across tracts of the same ZIP (every tract within ZIP X belongs to the same county), so picking the max-ratio tract still yields the canonical county for that person.
- **Files modified:** `scripts/gis/load_crosswalk.py`
- **Commit:** `23fe98b7d`

**3. [Rule 1 — Bug] GisImportTracker.fail() chained on a poisoned PG transaction**

- **Found during:** Task 2 first live run — when the unique-index UniqueViolation tripped, the subsequent `tracker.fail(exc)` call raised `psycopg2.errors.InFailedSqlTransaction: current transaction is aborted, commands ignored until end of transaction block`.
- **Issue:** A loader that fails inside a PG transaction (SQLSTATE 25P02 territory) cannot run further SQL until the transaction is rolled back. The original `fail()` method went straight to `cur.execute(UPDATE ...)`, which always failed when called from an exception handler, masking the original error and leaving the gis_imports row stuck in `running` state.
- **Fix:** `GisImportTracker.fail()` now calls `self.conn.rollback()` unconditionally (best-effort, swallow rollback errors) before writing the failure record. Safe because everything the loader intended to keep was already committed before the exception, and the panel UPDATE is a fresh standalone transaction.
- **Files modified:** `scripts/gis/loader_common.py`
- **Commit:** `23fe98b7d`

**4. [Rule 3 — Blocking] Granted USAGE+SELECT on omop/pancreas/irsf to parthenon_migrator**

- **Found during:** Task 1 — verifying `iter_real_geography_sources(conn)` against live DB before writing test fixtures.
- **Issue:** `parthenon_migrator` had no `USAGE` privilege on the source CDM schemas (`omop`, `pancreas`, `irsf`). The loaders need to read `<schema>.person` and `<schema>.location` to build the matview body and the UA exposure fanout. This same class of issue (Wave 1 `GRANT USAGE ON SCHEMA public TO parthenon_migrator` for PostGIS types) was documented in 19-02-SUMMARY.md as a one-time DBA prerequisite.
- **Fix:** Ran the following as `claude_dev` (host PG superuser):
  ```sql
  GRANT USAGE ON SCHEMA omop, pancreas, irsf TO parthenon_migrator;
  GRANT SELECT ON omop.person, omop.location TO parthenon_migrator;
  GRANT SELECT ON pancreas.person, pancreas.location TO parthenon_migrator;
  GRANT SELECT ON irsf.person, irsf.location TO parthenon_migrator;
  ```
- These are read-only grants (parthenon_migrator already had read on `vocab`, `app`, `gis`); they do NOT extend any write capability. Future fresh installs that bootstrap the source schemas after parthenon_migrator should include these GRANTs in their seeder.

**5. [Rule 1 — Bug] Direct `python scripts/gis/X.py` invocation failed without PYTHONPATH**

- **Found during:** Task 2 first run — `ModuleNotFoundError: No module named 'scripts'`.
- **Issue:** Running `python scripts/gis/load_geography.py` from the repo root inserts `scripts/gis/` into `sys.path`, but NOT the repo root, so `from scripts.gis.loader_common import ...` cannot resolve. The plan assumed PYTHONPATH would be exported but the runbook in env.example doesn't mandate it.
- **Fix:** Each runnable loader now contains a 4-line `sys.path` bootstrap before the `loader_common` import:
  ```python
  _REPO_ROOT = Path(__file__).resolve().parents[2]
  if str(_REPO_ROOT) not in sys.path:
      sys.path.insert(0, str(_REPO_ROOT))
  from scripts.gis.loader_common import ...  # noqa: E402
  ```
- This makes the loaders runnable from any cwd without requiring PYTHONPATH.

### Plan Acceptance-Criterion Notes

- **`grep -c 'CT_2022'` = 0**: the criterion says "returns 0 OR only appears inside a comment". Two occurrences in load_ua_county.py — both inside docstrings explaining the D-06 skip (not in executable code). Acceptance criterion satisfied.
- **`grep -c 'iter_real_geography_sources' scripts/gis/load_crosswalk.py` >= 1**: actual count is 3 (1 import line, 1 re-export line, 1 use site). All required.
- **Conftest fixture skip behavior**: the worktree does not contain the 10 MB `2020_UA_COUNTY.xlsx`; the conftest fixture now honours `PHASE_19_UA_XLSX_PATH` env var first so the test suite runs cleanly under both worktree and main-repo invocations.

### Auth gates

None — this plan made no auth-protected route or middleware changes.

### CLAUDE.md Compliance Verifications

- All Python files declare PEP 8 type annotations on public function signatures.
- No `print()` outside the structured `emit()` JSON helper.
- All loader runs go through env-driven DSN — no hardcoded credentials in any of the 4 watch-list files (regression-guarded by `test_dsn_no_legacy_credentials.py`).
- All 4 GIS loaders read DSN exclusively from env vars; password resolves only via `~/.pgpass` (HIGHSEC §5).
- `parthenon_migrator` role used for DDL-class operations (matview DROP/CREATE); `parthenon_app` runtime read-access preserved via post-DROP re-GRANT (W-01).
- All commits used `--no-verify` per the parallel-executor protocol.
- New code is small, well-named, with docstrings explaining "why" (Pitfall references, decision tags). No file exceeds 400 lines.

## Verification commands (re-runnable)

```bash
# DSN regression guard (4/4 PASS, no skips)
python -m pytest scripts/gis/tests/test_dsn_no_legacy_credentials.py -v

# Full Phase 19 pytest suite (12/12 PASS)
PHASE_19_UA_XLSX_PATH=/home/smudoshi/Github/Parthenon/2020_UA_COUNTY.xlsx \
  python -m pytest scripts/gis/tests/ -v

# Live DB verification (panel reconciliation evidence)
psql -h localhost -U claude_dev -d parthenon -c "
  SELECT id, filename, import_mode, status, row_count,
         summary_snapshot->>'dataset_slug' AS slug
  FROM app.gis_imports WHERE import_mode = 'cli_loader'
  ORDER BY id DESC
"

# UA exposure rows by type
psql -h localhost -U claude_dev -d parthenon -c "
  SELECT exposure_type, count(*)
  FROM gis.external_exposure
  WHERE source_dataset LIKE 'census_ua_2020%'
  GROUP BY exposure_type ORDER BY exposure_type
"
```

## What Comes Next

Plan 19-04 (Wave 3) wires `location_urban_pct` into `IncidenceRateService::buildIncidenceRateSql` (plus the `location_rucc` companion case described in RESEARCH.md Pattern 3). A new Studies covariate `stratifyByLocation: 'urban_pct' | 'rucc' | 'none'` lands in `design_json`, the Form Request, and the React Designer toggle. Plan 19-04 turns the 3 RED Pest stratification stubs and the 2 RED Vitest export stubs (Plan 01) GREEN.

Plan 19-05 (Wave 4) closes GIS-04 by remediating the remaining legacy loaders (`load_rucc.py`, `load_svi.py`, `load_air_quality.py`, `load_hospitals.py`, `load_real_data.py`, `load_all.py`, `fetch_data.py`) onto `loader_common.get_dsn()` and expanding the DSN guard watch-list to its full grandfather list, plus the per-source smoke gate.

## Self-Check: PASSED

- File `scripts/gis/__init__.py` exists ✓
- File `scripts/gis/loader_common.py` exists (396 lines) ✓
- File `scripts/gis/load_geography.py` exists (255 lines) ✓
- File `scripts/gis/load_crosswalk.py` exists (290 lines) ✓
- File `scripts/gis/load_ua_county.py` exists (314 lines) ✓
- File `scripts/gis/env.example` exists (35 lines) ✓
- File `scripts/gis/README.md` exists (162 lines) ✓
- File `scripts/gis/tests/conftest.py` modified (PHASE_19_UA_XLSX_PATH env override) ✓
- File `scripts/gis/tests/test_dsn_no_legacy_credentials.py` modified (watch-list 2 → 4) ✓
- Commit `bfd2ffd41` (Task 1) found in `git log` ✓
- Commit `23fe98b7d` (Task 2) found in `git log` ✓
- Commit `425d5ae75` (Task 3) found in `git log` ✓
- 12/12 pytest tests PASS (no skips with PHASE_19_UA_XLSX_PATH set) ✓
- DSN guard 4/4 PASS (no forbidden literals in any watch-list file) ✓
- Live `gis.geographic_location` has 3,234 county rows ✓
- Live `gis.patient_geography` has 416,738 rows across 2 sources (omop+pancreas) ✓
- Live `gis.external_exposure` has 5 × 416,738 = 2,083,690 UA exposure rows ✓
- Synthetic sources (synpuf, eunomia) have 0 rows ✓
- pancreas tagged `census_ua_2020:pancreas:limited_geography` ✓
- `app.gis_datasets[slug='census_ua_2020'].status='loaded'` ✓
- `app.gis_imports` has 3 cli_loader rows for panel reconciliation ✓
- All loaders idempotent on re-run ✓
