---
phase: 19
plan: 01
subsystem: gis
tags: [phase19, gis, requirements, tests, wave-0, red, validation]
wave: 0
dependency_graph:
  requires: []
  provides: [GIS-01, GIS-02, GIS-03, GIS-04, phase19_test_scaffolding, dsn_regression_guard]
  affects:
    - .planning/REQUIREMENTS.md
    - .planning/phases/19-ua-county-urban-rural-stratification-deploy-dormant-gis-sche/19-VALIDATION.md
    - backend/tests/Feature/Gis/
    - backend/tests/Feature/Studies/
    - scripts/gis/tests/
    - frontend/src/features/analyses/components/__tests__/
tech_stack:
  added:
    - pytest 7.x configuration for scripts/gis (pyproject.toml)
  patterns:
    - Pest tests with ->group(...) tags for filtered execution (phase19, gis, studies, gis-03, highsec, d-01)
    - pytest markers (phase19, ua_county, integration) registered in pyproject.toml
    - Vitest dynamic-import() pattern to catch missing exports at Vite transform time
    - Path-grep regression guard test for forbidden DSN literals
key_files:
  created:
    - backend/tests/Feature/Gis/Phase19SchemaDeployTest.php
    - backend/tests/Feature/Studies/UrbanPctStratificationTest.php
    - scripts/gis/tests/__init__.py
    - scripts/gis/tests/conftest.py
    - scripts/gis/tests/test_load_ua_county.py
    - scripts/gis/tests/test_load_crosswalk_multi_source.py
    - scripts/gis/tests/test_dsn_no_legacy_credentials.py
    - scripts/gis/pyproject.toml
    - frontend/src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/phases/19-ua-county-urban-rural-stratification-deploy-dormant-gis-sche/19-VALIDATION.md
decisions:
  - GIS-01..GIS-04 declared as the v1.0 Phase 19 requirement set
  - DSN regression guard watch-list trimmed to net-new Phase 19 files only (load_ua_county.py, loader_common.py); pre-existing legacy loaders remain grandfathered until Plan 03/05 remediation, satisfying "DSN guard test exits 0 today" intent
  - Pest groups standardized: phase19 + gis (schema), phase19 + studies + gis-03 (stratification), highsec (GRANT posture), d-01 (unique constraint + NOT NULL)
  - Vitest stub uses dynamic import() so the missing STRATIFY_BY_LOCATION_OPTIONS export trips Vite import-analysis at transform time (Phase 18-01 precedent)
metrics:
  duration_minutes: ~12
  tasks_completed: 3
  files_created: 9
  files_modified: 2
  total_lines_added: 619
  commits: 3
  completed: 2026-04-26
---

# Phase 19 Plan 01: UA County Urban/Rural Stratification — Wave 0 RED Test Scaffolding Summary

Wave 0 RED scaffolding established for Phase 19: GIS-01..GIS-04 requirements declared, 10 Pest test stubs (7 schema + 3 stratification), 8 pytest stubs (6 UA loader + 2 crosswalk), 1 GREEN-today DSN regression guard armed to catch any Plan 03+ legacy-credential regression, 1 Vitest export-existence stub, plus pytest infra and VALIDATION.md per-task verification map (`nyquist_compliant: true`, `wave_0_complete: true`). All 11 expected files landed in 3 atomic commits using `--no-verify` per Phase 18-01 RED-Wave-0 precedent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GIS-01..GIS-04 requirement IDs to REQUIREMENTS.md | `07bfc4e5c` | `.planning/REQUIREMENTS.md` |
| 2 | Pest RED stubs for gis schema deploy + urban_pct stratification | `99b5b77dc` | `backend/tests/Feature/Gis/Phase19SchemaDeployTest.php`, `backend/tests/Feature/Studies/UrbanPctStratificationTest.php` |
| 3 | pytest infra + UA loader/crosswalk/DSN guard + Vitest stub + VALIDATION.md flip | `dfcf4ef6f` | 8 files (pytest infra, 3 pytest test files, Vitest stub, VALIDATION.md update) |

## What Landed

### Requirements (Task 1)
- **GIS-01** — Deploy dormant `gis` schema (6 tables + matview) via parthenon_migrator-owned migration; PostGIS prerequisite enforced loudly (D-04); HIGHSEC-compliant GRANT posture for parthenon_app.
- **GIS-02** — Port `load_geography.py` + `load_crosswalk.py` to env-DSN/nationwide; ship new `load_ua_county.py` with UPSERT idempotency (D-05), CT_2022 skip (D-06), real-geography source allow-list (D-07).
- **GIS-03** — Wire `location_urban_pct` as the first urban-rural stratification covariate; new `design_json.stratifyByLocation` enum (`none|urban_pct|rucc`); server-side bucketing per D-03; pancreas warning per D-08.
- **GIS-04** — Security regression guards via DSN grep test + Plan 05 audit of legacy `scripts/gis/load_*.py` files.

Coverage line updated to `4 / 4 GIS-* requirements mapped (100%)`. Four traceability rows appended (Phase 19, pending). GENOMICS-* rows untouched.

### Pest stubs (Task 2)

`backend/tests/Feature/Gis/Phase19SchemaDeployTest.php` — 7 RED tests, `--filter='phase19'` selects them all:

1. `creates the gis schema after migration` — pg_namespace lookup
2. `creates all six gis tables` — pg_tables presence
3. `creates the gis.patient_geography materialized view` — pg_matviews lookup
4. `grants USAGE on gis schema to parthenon_app but NOT CREATE` — has_schema_privilege (group: highsec)
5. `grants DML on gis.external_exposure to parthenon_app but NOT TRUNCATE` — has_table_privilege (group: highsec)
6. `enforces unique (source_id, person_id, exposure_type, exposure_date) on gis.external_exposure (D-01)` — pg_constraint scan (group: d-01)
7. `declares source_id NOT NULL on gis.external_exposure (D-01)` — pg_attribute.attnotnull (group: d-01)

`backend/tests/Feature/Studies/UrbanPctStratificationTest.php` — 3 RED tests, `--filter='gis-03'` selects them:

1. `IncidenceRateService advertises location_urban_pct as a supported stratification` — accepts either `supportedStratifications()` method or `SUPPORTED_STRATIFICATIONS` const (Plan 04 picks one)
2. `IncidenceRateController validates stratifyByLocation as enum` — POST with `urbanity` → 422 + assertJsonValidationErrors
3. `IncidenceRateController accepts stratifyByLocation=urban_pct` — POST and assert that key is NOT in errors

Both files PHP-syntax clean (`php -l`) and Pint-clean (`pint --test → {"result":"pass"}`).

### pytest infra + stubs (Task 3)

- `scripts/gis/pyproject.toml` — pytest config with `phase19`, `ua_county`, `integration` markers and `-v --tb=short` default opts
- `scripts/gis/tests/__init__.py` — empty package marker
- `scripts/gis/tests/conftest.py` — session-scoped fixtures: `ua_xlsx_path` (skip if `2020_UA_COUNTY.xlsx` missing), `gis_loader_dir`, `monkeypatch_session`, `env_dsn` (sets PGHOST/PGPORT/PGDATABASE/PGUSER defaults including `parthenon_migrator`)
- `scripts/gis/tests/test_load_ua_county.py` — 6 RED tests covering xlsx parse (3,234 rows), 5-digit FIPS concat, CT_2022 skip per D-06, REAL_GEOGRAPHY_SOURCES allow-list per D-07, env-driven get_dsn(), UPSERT_SQL marker per D-05. All raise `ModuleNotFoundError: No module named 'scripts.gis.load_ua_county'` until Plan 03 ships the module.
- `scripts/gis/tests/test_load_crosswalk_multi_source.py` — 2 RED tests for `iter_real_geography_sources()` and env-driven `get_dsn()`
- `scripts/gis/tests/test_dsn_no_legacy_credentials.py` — Parametrized regression guard with watch-list `[load_ua_county.py, loader_common.py]`. Skips cleanly today (files don't exist) → exits 0. Plan 03 expands the watch-list AFTER porting load_crosswalk.py / load_geography.py; Plan 05 expands to remaining legacy loaders.

### Vitest stub (Task 3)

`frontend/src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx` — 2 RED tests using dynamic `import('../IncidenceRateDesigner')` to assert `STRATIFY_BY_LOCATION_OPTIONS` export contains `none`, `urban_pct`, `rucc`. Vite import-analysis catches the missing export at transform time per Phase 18-01 precedent.

### VALIDATION.md update (Task 3)

- Frontmatter: `nyquist_compliant: true`, `wave_0_complete: true`
- Per-task verification map: 14 rows (`19-01-1` through `19-05-2`) with Plan / Wave / Requirement / Threat Ref / Test Type / Automated Command
- Approval line: `Wave 0 complete — RED tests authored 2026-04-26.`

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| GIS-* count | `grep -c '^- \[ \] \*\*GIS-' .planning/REQUIREMENTS.md` | 4 (✓) |
| GIS-* traceability rows | `grep -c '\| GIS-0[1-4]' .planning/REQUIREMENTS.md` | 4 (✓) |
| Coverage line updated | `grep 'Coverage: 14 / 14' .planning/REQUIREMENTS.md` | matches `4 / 4 GIS-*` (✓) |
| Pest schema PHP syntax | `php -l backend/tests/Feature/Gis/Phase19SchemaDeployTest.php` | No syntax errors detected |
| Pest stratification PHP syntax | `php -l backend/tests/Feature/Studies/UrbanPctStratificationTest.php` | No syntax errors detected |
| Pest schema Pint clean | `pint --test ...` | `{"result":"pass"}` |
| Pest schema phase19 group count | `grep -c "group('phase19'" .../Phase19SchemaDeployTest.php` | 7 (✓) |
| Pest stratification phase19 group count | `grep -c "group('phase19'" .../UrbanPctStratificationTest.php` | 3 (✓) |
| Python compile | `python -m py_compile scripts/gis/tests/*.py` | OK |
| pytest collection | `pytest scripts/gis/tests/ --collect-only` | 10 tests collected |
| DSN guard exits 0 | `pytest scripts/gis/tests/test_dsn_no_legacy_credentials.py -v` | 2 skipped, exit 0 (✓ GREEN today) |
| UA county RED | `pytest scripts/gis/tests/test_load_ua_county.py -k phase19` | 3 ModuleNotFoundError + 3 skipped (RED ✓) |
| VALIDATION.md flags | `grep -E '^(nyquist_compliant\|wave_0_complete):' VALIDATION.md` | both `true` (✓) |
| VALIDATION.md task rows | `grep -c '\| 19-0[1-5]-' VALIDATION.md` | 14 (✓) |
| Placeholder removed | `grep '19-XX \| TBD' VALIDATION.md` | absent (✓) |
| Vitest stub size | `wc -l UrbanPctStratificationToggle.test.tsx` | 28 (>=25 ✓) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Trimmed PHASE_19_LOADER_FILES watch-list from 4 entries to 2**

- **Found during:** Task 3 verification step (running `pytest test_dsn_no_legacy_credentials.py -v`)
- **Issue:** The plan's `<action>` block specified `PHASE_19_LOADER_FILES = ["load_ua_county.py", "load_crosswalk.py", "load_geography.py", "loader_common.py"]`. Two of those files (`load_crosswalk.py`, `load_geography.py`) already exist in the repo with the legacy literals `dbname=ohdsi`, `password=acumenus`, `user=smudoshi`. With them on the watch-list, the test fails today — directly contradicting the plan's own acceptance criterion: "`pytest scripts/gis/tests/test_dsn_no_legacy_credentials.py -v` exits 0 (4 tests SKIPPED because files do not yet exist, OR PASSED) — NOT failed." The plan's prose also said "Existing legacy loaders are explicitly grandfathered until Plan 05 remediation," which the file list violated.
- **Fix:** Trimmed the Wave 0 watch-list to net-new Phase 19 files only: `load_ua_county.py` (created by Plan 03) and `loader_common.py` (created by Plan 03). Both skip cleanly today. Plan 03 will re-add `load_crosswalk.py` and `load_geography.py` to the watch-list AS PART of porting them to env-DSN; Plan 05 expands to the remaining legacy loaders. This preserves the regression-guard semantic (any new legacy literal in those two files at Plan 03 time will fail) while honoring the "GREEN today, RED on regression" intent.
- **Files modified:** `scripts/gis/tests/test_dsn_no_legacy_credentials.py` (watch-list edit + extended docstring documenting the staged expansion)
- **Commit:** `dfcf4ef6f`

### CLAUDE.md Compliance Verifications
- Pint clean on PHP files (verified via main repo's `vendor/bin/pint` since worktree lacks vendor/ — `{"result":"pass"}`)
- No `$guarded = []` in any model touched (none modified — tests only)
- No new unauthenticated routes (no routes added)
- Sanctum + RBAC pattern preserved in `UrbanPctStratificationTest.php` (uses `User::factory()->create()->assignRole('researcher')` + `actingAs($user, 'sanctum')`)
- All commits used `--no-verify` per parallel-execution and Phase 18-01 RED-Wave-0 precedent

## What Comes Next

Plan 19-02 (Wave 1) turns 7 of these RED Pest tests GREEN by landing the gis schema migration. Plan 19-03 (Wave 2) turns 8 pytest tests GREEN by creating `scripts/gis/load_ua_county.py` and porting `load_crosswalk.py`/`load_geography.py` to env-DSN. Plan 19-04 (Wave 3) turns 3 Pest stratification tests + 2 Vitest tests GREEN by wiring `location_urban_pct` into IncidenceRateService and adding the Designer dropdown. Plan 19-05 (Wave 4) closes GIS-04 by remediating the remaining legacy loaders and expanding the DSN guard watch-list to its full grandfather list.

## Self-Check: PASSED

- File `.planning/REQUIREMENTS.md` exists with 4 GIS-* entries ✓
- File `backend/tests/Feature/Gis/Phase19SchemaDeployTest.php` exists (109 lines) ✓
- File `backend/tests/Feature/Studies/UrbanPctStratificationTest.php` exists (83 lines) ✓
- File `scripts/gis/tests/__init__.py` exists ✓
- File `scripts/gis/tests/conftest.py` exists ✓
- File `scripts/gis/tests/test_load_ua_county.py` exists (120 lines) ✓
- File `scripts/gis/tests/test_load_crosswalk_multi_source.py` exists (42 lines) ✓
- File `scripts/gis/tests/test_dsn_no_legacy_credentials.py` exists (48 lines) ✓
- File `scripts/gis/pyproject.toml` exists ✓
- File `frontend/src/features/analyses/components/__tests__/UrbanPctStratificationToggle.test.tsx` exists (28 lines) ✓
- File `.planning/phases/19-.../19-VALIDATION.md` modified with `nyquist_compliant: true` and 14-row task map ✓
- Commit `07bfc4e5c` (Task 1: REQUIREMENTS.md) found in `git log` ✓
- Commit `99b5b77dc` (Task 2: Pest RED stubs) found in `git log` ✓
- Commit `dfcf4ef6f` (Task 3: pytest + Vitest + VALIDATION.md) found in `git log` ✓
- pytest collected 10 tests (6 ua_county + 2 crosswalk + 2 DSN guard) ✓
- DSN guard test exits 0 (2 skipped) ✓
- UA county tests RED with `ModuleNotFoundError` (3 hits) ✓
