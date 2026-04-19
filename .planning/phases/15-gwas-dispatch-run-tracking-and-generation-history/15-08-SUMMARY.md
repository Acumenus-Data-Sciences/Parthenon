---
phase: 15
plan: 08
subsystem: finngen-endpoint-browser
tags: [pest, vitest, tests, phase-15, gwas, wave-5-tests]
requirements: [GENOMICS-03, GENOMICS-05, GENOMICS-14]
status: complete
completed: 2026-04-19
dependency_graph:
  requires:
    - "15-01 (migration + EndpointGwasRun + exceptions)"
    - "15-02 (GwasRunService::dispatchFullGwas)"
    - "15-03 (FinnGenGwasRunObserver + registration)"
    - "15-04 (FormRequest + controller + routes)"
    - "15-05 (api.ts types + TanStack Query hooks)"
    - "15-06 (GenerationHistorySection + GwasRunsSection + RunGwasPanel)"
    - "15-07 (drawer wiring + Phase 16 stub route)"
  provides:
    - "6 Pest feature tests covering HTTP dispatch contract, schema, drawer show(), eligible-controls, route middleware"
    - "1 Pest unit test covering observer backfill + idempotency + swallow + step-1 failure"
    - "5 Vitest tests covering component state machines + hook invalidation contract"
    - "TestCase cross-connection PDO + transaction-counter sharing (unblocks pgsql-read controllers under RefreshDatabase)"
  affects:
    - "Plan 15-09 (real E2E smoke) — CI harness is now green, so the real gate can run without red-test noise."
tech_stack:
  added: []
  patterns:
    - "Cross-connection PDO + transaction-counter sync in TestCase (pattern for any test touching pgsql + finngen)"
    - "Savepoint-wrapped cross-schema probe in observer (CLAUDE.md Gotcha #12 mitigation)"
    - "Fake FinnGenRunService binding in service container for HTTP contract tests"
key_files:
  created:
    - "backend/tests/Feature/FinnGen/EndpointGwasDispatchTest.php"
    - "backend/tests/Feature/FinnGen/EndpointGwasRunsSchemaTest.php"
    - "backend/tests/Feature/FinnGen/EndpointDetailGwasRunsTest.php"
    - "backend/tests/Feature/FinnGen/EndpointDetailGenerationHistoryTest.php"
    - "backend/tests/Feature/FinnGen/EligibleControlsEndpointTest.php"
    - "backend/tests/Feature/FinnGen/EndpointGwasRouteMiddlewareTest.php"
    - "backend/tests/Unit/FinnGen/FinnGenGwasRunObserverTest.php"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/GenerationHistorySection.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/GwasRunsSection.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/RunGwasPanel.test.tsx"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/useDispatchGwas.test.ts"
    - "frontend/src/features/finngen-endpoint-browser/__tests__/useEligibleControlCohorts.test.ts"
  modified:
    - "backend/tests/TestCase.php"
    - "backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php"
    - "backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php"
decisions:
  - "Kept plan-sanctioned tests at __tests__/ (feature root) even though Plan 15-06 already shipped tests at components/__tests__/. The new files target the Plan 08 Test Map rows; the Plan 06 files remain as the per-component comprehensive suites. Zero overlap in assertions."
  - "Added PDO + transaction-counter sharing for the pgsql connection in tests/TestCase.php. Unblocks every future test that exercises a controller which calls DB::connection('pgsql')->* across an Eloquent read on the default pgsql_testing connection."
  - "Savepoint-wrapped the cross-schema MIN(p_value) probe in FinnGenGwasRunObserver so a missing per-source schema no longer poisons the parent transaction."
  - "Fixed EndpointBrowserController::eligibleControls — WHERE clause now uses cd.author_id + cd.is_public to match the real app.cohort_definitions schema (was owner_user_id, which does not exist)."
metrics:
  duration_min: 89
  tasks_completed: 3
  files_touched: 15
  tests_added: 52
---

# Phase 15 Plan 15-08: Test Envelope + Transaction-Poisoning Guard Summary

Wave 5 test coverage: 7 Pest files (6 feature + 1 unit) and 5 Vitest files spanning the Phase 15 HTTP surface, schema, observer, and frontend state machines. Two production-grade Rule 1 fixes landed alongside — the eligible-controls WHERE clause and the observer's MIN(p_value) transaction-poisoning fix.

## Outcome

| Layer | Tests Added | Status |
|-------|-------------|--------|
| Pest feature (HTTP) | 32 across 6 files | All green |
| Pest unit (observer) | 6 in 1 file | All green |
| Vitest component + hook | 14 across 5 files | All green |
| Pint | — | Green |
| PHPStan pre-commit hook | — | Green (full `app/` scan) |
| `tsc --noEmit` | — | Exit 0 |
| `vite build` | — | Built in 1.02s |
| ESLint (touched files) | — | Clean |

## Tasks

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | 6 Pest feature tests + TestCase + controller Rule-1 fix | ✓ | `9d5c39f17` |
| 2 | Observer unit test + savepoint-guard Rule-1 fix | ✓ | `9b73db539` |
| 3 | 5 Vitest tests | ✓ | `c86a9e7ea` |

## Per-File Test Counts (green)

### Pest Feature (`tests/Feature/FinnGen/`)

| File | Tests | Coverage |
|------|-------|----------|
| `EndpointGwasDispatchTest.php` | 14 | D-01/D-04/D-07/D-08/D-10 — all 14 scenarios from 15-RESEARCH §Test Map: happy paths, 422s (6), 409s (2), supersede, 404s (2), default covariate resolution, shape snapshot |
| `EndpointGwasRunsSchemaTest.php` | 4 | table exists, 5 Plan 15-01 indexes, CHECK constraint enforcement, parthenon_app grants present |
| `EndpointDetailGwasRunsTest.php` | 2 | show() response joins control_cohort_name / covariate_set_label; 100-row cap |
| `EndpointDetailGenerationHistoryTest.php` | 3 | multiple runs per source (D-18), 100-row cap, non-`endpoint.generate` types excluded |
| `EligibleControlsEndpointTest.php` | 4 | source_key required (422), FinnGen-offset cohorts excluded, cohort must have generation on source, response shape |
| `EndpointGwasRouteMiddlewareTest.php` | 5 | POST 401/403, POST 429 rate limit + Retry-After, GET 401, GET 429 rate limit |

### Pest Unit (`tests/Unit/FinnGen/`)

| File | Tests | Coverage |
|------|-------|----------|
| `FinnGenGwasRunObserverTest.php` | 6 | step-2 success backfill, case_n/control_n extraction, top_hit_p_value MIN query success, MIN query swallow on missing schema (savepoint-guarded), observer idempotency, step-1 failure → tracking row failed |

### Vitest (`frontend/src/features/finngen-endpoint-browser/__tests__/`)

| File | Tests | Coverage |
|------|-------|----------|
| `GenerationHistorySection.test.tsx` | 3 | empty state, group-by-source collapsed, expand-on-click |
| `GwasRunsSection.test.tsx` | 3 | empty state, flat newest-first Phase-16 links, superseded back-link with opacity-60 |
| `RunGwasPanel.test.tsx` | 5 | collapsed-with-no-sources, default covariate auto-select, run_in_flight banner + link, duplicate_run banner copy, CTA enable ladder |
| `useDispatchGwas.test.ts` | 1 | dual-key invalidation on success |
| `useEligibleControlCohorts.test.ts` | 2 | disabled when sourceKey empty, threads source_key through |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `EndpointBrowserController::eligibleControls` referenced nonexistent `owner_user_id` column**
- **Found during:** Task 1 (test hitting `POST /endpoints/{name}/eligible-controls` failed with `column "owner_user_id" does not exist`)
- **Issue:** Plan 15-04's controller assumed an `owner_user_id` column on `app.cohort_definitions`. The real schema has `author_id` (FK to `app.users`) + `is_public` (boolean). Any call to the endpoint in production would 500.
- **Fix:** Rewrote the WHERE clause to `(? = TRUE OR cd.author_id = ? OR cd.is_public = TRUE)` — admin/super-admin bypass, owner access, and public cohorts. Matches the real schema.
- **Files modified:** `backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php:750`
- **Commit:** `9d5c39f17` (bundled into Task 1)

**2. [Rule 1 - Bug] `FinnGenGwasRunObserver::computeTopHitPValue` could poison the parent PG transaction**
- **Found during:** Task 2 (`it swallows top_hit_p_value MIN query failure on a nonexistent source schema` failed with `SQLSTATE[25P02]` on the follow-on `$tracking->refresh()`)
- **Issue:** The D-17 bounded MIN(p_value) probe reads `{source}_gwas_results.summary_stats` via `DB::connection('pgsql')`. When the schema is missing (e.g., a new source that hasn't been provisioned), the query errors; the observer caught the exception — but PostgreSQL 25P02 had already poisoned the enclosing transaction, causing every subsequent statement to fail. This would manifest in production any time a new source is dispatched before its GWAS results schema exists.
- **Fix:** Wrapped the probe in `$conn->beginTransaction()` + `commit()` / `rollBack()`. Laravel emits SAVEPOINT when nested; the failed probe rolls back to the savepoint, leaving the outer transaction viable.
- **Files modified:** `backend/app/Observers/FinnGen/FinnGenGwasRunObserver.php:126-170`
- **Commit:** `9b73db539` (bundled into Task 2)

**3. [Rule 3 - Blocker] TestCase needed cross-connection PDO + transaction-counter sharing**
- **Found during:** Task 1 setup (controller calls `DB::connection('pgsql')` while tests ran on `pgsql_testing` + finngen shared PDO only)
- **Issue:** Without PDO sharing, the controller's pgsql reads could not see seeded fixtures inside RefreshDatabase's transaction, and `DB::connection('finngen')->transaction(...)` inside `dispatchFullGwas` called `BEGIN` on a PDO with an active outer transaction → PDO error.
- **Fix:** (a) Share the `pgsql` connection's PDO with the default pgsql_testing connection. (b) Copy RefreshDatabase's `transactions` counter via Reflection onto the finngen + pgsql connection instances so Laravel issues `SAVEPOINT` (not `BEGIN`) for nested transactions.
- **Files modified:** `backend/tests/TestCase.php`
- **Commit:** `9d5c39f17` (bundled into Task 1)

## Test DB Schema Drift (accepted)

Testing DB still has `finngen.endpoint_generations.cohort_definition_id` as NOT NULL; production dropped this in Phase 13.2 D-01. Tests pass a sentinel value (`1`) to satisfy the constraint without using the column. Flagged for a future migration replay on the testing DB.

## HIGHSEC Posture

- Three-layer route protection verified in `EndpointGwasRouteMiddlewareTest`: auth:sanctum, permission:finngen.workbench.use, throttle.
- HIGHSEC §4.1 grants verified in `EndpointGwasRunsSchemaTest` (parthenon_app has SELECT/INSERT/UPDATE/DELETE).
- SQL-injection allow-listing preserved (observer regex check on schema name, controller regex on source_key).
- Mass-assignment `$fillable` discipline verified via EndpointGwasRun create paths in tests.

## Sibling-Worktree Bind-Mount

Deferred from Plan 15-06/15-07: `parthenon-php` and `parthenon-node` containers are bind-mounted to `/home/smudoshi/Github/Parthenon-i18n-unified/{backend,frontend}`, not this working tree. Every file authored in the main tree was mirrored to the sibling before running tests. Purely operational; no code impact. Flagged again as it continues to cost ~10 seconds of friction per iteration.

## Handoff to Plan 15-09

- CI harness is now green: 38 Pest tests + 14 Vitest tests exercise Phase 15's HTTP, service, observer, and component surface.
- Plan 15-09's real E2E smoke (`finngen:gwas-smoke-test --via-http --endpoint=E4_DM2 --source=PANCREAS --control-cohort=221`) is unblocked.
- Any future test that exercises a controller using `DB::connection('pgsql')` alongside seeded RefreshDatabase fixtures inherits the TestCase PDO+counter sync automatically.

## Deferred Issues

- Testing DB schema drift on `finngen.endpoint_generations.cohort_definition_id` (NOT NULL vs nullable in prod). Fix by re-running phase 13.2 migrations against parthenon_testing.
- PHPStan memory exhaustion on direct analysis of scoped file lists (always scans the `app/` directory per phpstan.neon). Pre-commit hook runs the full project scan and passes; direct per-file analysis from an agent requires `php -d memory_limit=4G`.

## Self-Check: PASSED

- `backend/tests/Feature/FinnGen/EndpointGwasDispatchTest.php` — FOUND
- `backend/tests/Feature/FinnGen/EndpointGwasRunsSchemaTest.php` — FOUND
- `backend/tests/Feature/FinnGen/EndpointDetailGwasRunsTest.php` — FOUND
- `backend/tests/Feature/FinnGen/EndpointDetailGenerationHistoryTest.php` — FOUND
- `backend/tests/Feature/FinnGen/EligibleControlsEndpointTest.php` — FOUND
- `backend/tests/Feature/FinnGen/EndpointGwasRouteMiddlewareTest.php` — FOUND
- `backend/tests/Unit/FinnGen/FinnGenGwasRunObserverTest.php` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/GenerationHistorySection.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/GwasRunsSection.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/RunGwasPanel.test.tsx` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/useDispatchGwas.test.ts` — FOUND
- `frontend/src/features/finngen-endpoint-browser/__tests__/useEligibleControlCohorts.test.ts` — FOUND
- Commit `9d5c39f17` (Task 1) — FOUND via `git log`
- Commit `9b73db539` (Task 2) — FOUND via `git log`
- Commit `c86a9e7ea` (Task 3) — FOUND via `git log`
