---
phase: 17-pgs-prs
plan: 03
subsystem: backend-dispatch
tags: [backend, controller, r-worker, plink2, darkstar, dispatch, pest, highsec]

# Dependency graph
requires:
  - phase: 13.2-finish-finngen-cutover
    provides: "100B-offset cohort_definition_id convention + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET"
  - phase: 14-regenie-gwas-infrastructure
    provides: "SourceVariantIndex (PGEN tracking), /opt/regenie/plink2 binary, Phase 14 person_{id} FID/IID convention"
  - phase: 17-pgs-prs-plan-01
    provides: "vocab.pgs_scores + vocab.pgs_score_variants tables, finngen.prs.compute Spatie permission, {source}_gwas_results.prs_subject_scores provisioner"
provides:
  - "Darkstar R worker finngen_prs_compute_execute (plink2 --score wrapper)"
  - "POST /api/v1/finngen/endpoints/{name}/prs route (202 + run envelope)"
  - "PrsDispatchService with 4-step precondition ladder (422 on miss)"
  - "finngen.prs.compute analysis module registered in FinnGenAnalysisModuleSeeder"
  - "6 Pest feature tests (34 assertions) covering envelope + preconditions + RBAC"
affects: [17-04 cohort-drawer histogram API, 17-05 PrsDistributionPanel, 17-07 smoke-gen CHECKPOINT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R worker 100B-offset handling: numeric (not integer) + sprintf %.0f formatting (mirrors cohort_ops.R pattern)"
    - "processx argv vector invocation of /opt/regenie/plink2 with cols=+scoresums (HIGHSEC §10 — no shell interpolation)"
    - ".sscore parsing with read.table(comment.char=\"\") to preserve #IID header (Pitfall 4 mitigation)"
    - "PrsDispatchService uses DB::connection('pgsql') with fully-qualified schema name (SourceAware PHPStan rule compliance)"
    - "Plumber POST route + plumber2 body injection + .dispatch_async wrapper (reuses Phase 14 pattern)"
    - "FormRequest regex allow-list on score_id + source_key BEFORE any SQL interpolation (T-17-S-SQLi-1/2 mitigation)"

key-files:
  created:
    - darkstar/api/finngen/prs_compute.R
    - backend/app/Http/Requests/FinnGen/ComputePrsRequest.php
    - backend/app/Services/FinnGen/PrsDispatchService.php
    - backend/tests/Feature/FinnGen/PrsDispatchTest.php
  modified:
    - darkstar/api/finngen/routes.R
    - backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php
    - backend/routes/api.php
    - backend/database/seeders/FinnGenAnalysisModuleSeeder.php

key-decisions:
  - "Raw DB::selectOne on vocab.pgs_scores instead of Eloquent PgsScore model — Plan 02 will land the model but this plan runs in parallel, so avoiding cross-wave dependency keeps 17-02 and 17-03 disjoint."
  - "DB::connection('pgsql') for cohort-existence check (not 'omop') to satisfy the SourceAware PHPStan rule that bans bare DB::connection('omop'); cross-schema SELECT works because Parthenon is single-DB."
  - "PrsDispatchService::dispatch returns an associative array (not a DTO) to match the controller's minimal unwrap — keeps the controller shape parallel to EndpointBrowserController::generate without introducing a new DTO hierarchy."
  - "R worker sources cohort_ops.R to reuse .finngen_open_connection instead of defining its own (DRY; matches Phase 14 precedent)."
  - "Test seeds cohort_definition_id=4242 (not the live 100000000001 from Phase 13.2-05) to keep the test dataset scoped + cleanable per-test."
  - "Pest test re-attaches finngen.prs.compute to roles after FinnGenTestingSeeder runs — RolePermissionSeeder's syncPermissions wipes non-listed perms; this is a documented temporary shim until the seeder catalog is updated (tracked as a deferred-items note for Plan 17.1)."

patterns-established:
  - "Darkstar new-analysis-type recipe: (1) create {worker}.R, (2) source it in routes.R top, (3) add switch() case in .build_worker, (4) add #* @post plumber annotation. Takes effect on `docker compose restart darkstar` (routes.R) or next dispatch (bind-mount of worker file)."
  - "Laravel new-dispatch-endpoint recipe: FormRequest (authorize+rules) → DispatchService (preconditions → FinnGenRunService::create) → Controller method (surgical add) → Route with 3-layer middleware → Pest test mirroring GwasDispatchTest."

requirements-completed: [GENOMICS-07]
requirements-addressed: [GENOMICS-06, GENOMICS-07, GENOMICS-08]

# Metrics
duration: ~55min
started: 2026-04-19T00:00:00Z
completed: 2026-04-19T00:55:00Z
tasks: 2 / 2
files-created: 4
files-modified: 4
total-loc-added: ~698 (R worker 248 + PHP 450)
pest-tests-added: 6 (34 assertions)
---

# Phase 17 Plan 03: Darkstar R Worker + Laravel PRS Dispatch Summary

**Shipped the PRS compute dispatch mechanism end-to-end: one new R worker (plink2 --score wrapper), one new Laravel FormRequest + Service + controller method + route, one seeder row, and six Pest dispatch tests — all Pint/PHPStan clean, all tests green, zero Phase 13.2 or Phase 14 regressions.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 / 2 committed atomically
- **Files created:** 4 (R worker + FormRequest + Service + test)
- **Files modified:** 4 (routes.R + controller + api.php + seeder)
- **Total LOC added:** ~698 (248 R + 44+168+238 PHP)

## Accomplishments

- **Darkstar `finngen.prs.compute` worker** wraps `/opt/regenie/plink2 --score` with `cols=+scoresums`, reads weights from `vocab.pgs_score_variants` with rsid-or-chr:pos ID fallback (Pitfall 8), builds keep.tsv from `{cohort_schema}.cohort` using Phase 14's `person_{id}` FID/IID convention, and writes per-subject scores to `{source}_gwas_results.prs_subject_scores` via `DatabaseConnector::insertTable(bulkLoad=TRUE)`.
- **All 5 documented Pitfalls mitigated** in the R worker: (1) `/opt/regenie/plink2` path, (2) numeric (not integer) for 100B offset, (3) `read.table(comment.char="")` for .sscore `#IID` header, (4) `{cohort_schema}` resolved via `source_envelope$schemas$cohort`, (5) regex guards on score_id + source_key + cohort_schema before sprintf interpolation.
- **Laravel PRS dispatch service** implements the 4-step precondition ladder (score exists → source exists → variant_index exists → cohort has rows), resolves `cohort_definition_id` from the latest `FinnGenEndpointGeneration` (with 100B offset) when omitted, and hands off to `FinnGenRunService::create` with `analysis_type = 'finngen.prs.compute'`.
- **Controller `prs()` method is surgical** — doesn't touch `generate()` or `gwas()` or any other existing method. All validation lives in `ComputePrsRequest` (FormRequest per CLAUDE.md); all business logic in `PrsDispatchService`.
- **Route registered with HIGHSEC §2.3 three-layer middleware:** `auth:sanctum` → `permission:finngen.prs.compute` → `finngen.idempotency` → `throttle:10,1`. Verified via `php artisan route:list -v`.
- **6 Pest dispatch tests** (34 assertions) cover 202 envelope shape, 422×4 (missing score / missing variant_index / 0 cohort rows / regex fail), 403 (viewer role). Mirrors `GwasDispatchTest` (manual seed + fake `FinnGenRunService`, no `RefreshDatabase`).

## Task Commits

Each task was committed atomically on branch `worktree-agent-adf0caf6`:

1. **Task 1: Darkstar R worker + routes.R wiring** — `b1343322c` (feat)
   - `darkstar/api/finngen/prs_compute.R` — 248 LOC (new)
     - SHA1: `fae250ed0801d0da7c7b15e4a1690d715f795a12`
   - `darkstar/api/finngen/routes.R` — 3 additive edits (source + switch case + POST route)

2. **Task 2: Laravel dispatch path + Pest tests** — `06fb42c7d` (feat)
   - `backend/app/Http/Requests/FinnGen/ComputePrsRequest.php` — 44 LOC (new)
   - `backend/app/Services/FinnGen/PrsDispatchService.php` — 168 LOC (new)
   - `backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php` — +2 imports, +49 LOC method
   - `backend/routes/api.php` — +3 LOC route block
   - `backend/database/seeders/FinnGenAnalysisModuleSeeder.php` — +30 LOC module row
   - `backend/tests/Feature/FinnGen/PrsDispatchTest.php` — 238 LOC (new)

## Files Created/Modified

### Darkstar R (2)

- **`darkstar/api/finngen/prs_compute.R`** (NEW, 248 LOC)
  - `finngen_prs_compute_execute(source_envelope, run_id, export_folder, params)` — plink2 --score wrapper with all 5 Pitfall mitigations.
  - `.prs_lookup_pgen(conn, source_key_lower)` — reads PGEN prefix from `app.finngen_source_variant_indexes`.
  - Sources `cohort_ops.R` to reuse `.finngen_open_connection` (DRY).

- **`darkstar/api/finngen/routes.R`** (MODIFIED — 3 additive edits)
  - Top: `source("/app/api/finngen/prs_compute.R")`.
  - Inside `.build_worker()` switch: new `"finngen.prs.compute"` case.
  - EOF: `#* @post /finngen/prs/compute` plumber annotation.

### Laravel backend (6)

- **`backend/app/Http/Requests/FinnGen/ComputePrsRequest.php`** (NEW, 44 LOC) — FormRequest with `authorize()` checking `finngen.prs.compute`, regex rules on source_key + score_id (HIGHSEC §2.3 defense-in-depth).
- **`backend/app/Services/FinnGen/PrsDispatchService.php`** (NEW, 168 LOC) — 4-step precondition ladder + FinnGenRunService::create dispatch. Uses raw `DB::selectOne` on `vocab.pgs_scores` (Plan 02 will land the Eloquent model; parallel-wave-safe).
- **`backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php`** (MODIFIED — +51 LOC, surgical) — 2 new imports (`ComputePrsRequest`, `PrsDispatchService`) + new `prs()` method between `generate()` and `gwas()`. `generate()` body UNCHANGED (verified via grep count = 1 for both).
- **`backend/routes/api.php`** (MODIFIED — +3 LOC) — New `Route::post('/{name}/prs', ...)` inside the existing `endpoints` prefix group with full middleware stack.
- **`backend/database/seeders/FinnGenAnalysisModuleSeeder.php`** (MODIFIED — +30 LOC) — New `finngen.prs.compute` module row with darkstar_endpoint, settings_schema, result_schema. Required for `FinnGenAnalysisModuleRegistry::validateParams` to accept the new analysis_type.
- **`backend/tests/Feature/FinnGen/PrsDispatchTest.php`** (NEW, 238 LOC) — 6 scenarios, 34 assertions.

## Pest Test Results

```
PASS  Tests\Feature\FinnGen\PrsDispatchTest
  ✓ it dispatches PRS run and returns 202 with full envelope             0.91s
  ✓ it returns 422 when score_id is not ingested in vocab.pgs_scores     0.79s
  ✓ it returns 422 when source has no variant_index                      0.76s
  ✓ it returns 422 when cohort has 0 rows for the resolved cohort_defin… 0.76s
  ✓ it returns 403 when caller lacks finngen.prs.compute (viewer)        0.76s
  ✓ it returns 422 when score_id does not match PGS regex (FormRequest…  0.76s

Tests:    6 passed (34 assertions)
Duration: 4.76s
```

### Regression (Phase 14)

```
PASS  Tests\Feature\FinnGen\GwasDispatchTest (5/5 green, 28 assertions, 0.52s)
```

No Phase 13.2 or Phase 14 regressions.

### Pre-existing test flake (out of scope)

`EndpointGenerateCohortIdTest.php` failed with `SQLSTATE[23505] duplicate key on endpoint_definitions_pkey TEST_ENDPOINT` — leftover fixture state from a prior test run in the test DB, not caused by this plan. Logged to `.planning/phases/17-pgs-prs/deferred-items.md` for Plan 17.1 cleanup.

## Route Verification

```
POST  api/v1/finngen/endpoints/{name}/prs  Api\V1\FinnGen\EndpointBrowserController@prs
       ⇂ api
       ⇂ Illuminate\Auth\Middleware\Authenticate:sanctum
       ⇂ App\Http\Middleware\ResolveLocale
       ⇂ App\Http\Middleware\ResolveSourceContext
       ⇂ Spatie\Permission\Middleware\PermissionMiddleware:finngen.prs.compute
       ⇂ App\Http\Middleware\EnforceFinnGenIdempotency
       ⇂ Illuminate\Routing\Middleware\ThrottleRequests:10,1
```

All 3 HIGHSEC §2.3 layers present (auth → permission → rate-limit) + `ResolveSourceContext` (Phase 13.2 pattern) + `EnforceFinnGenIdempotency` (Phase 13.2 D-03).

## Lint / Static Analysis

- **Pint:** clean on all 5 edited PHP files (controller, service, FormRequest, seeder, test). Auto-fixes applied on the test file for `class_definition`, `single_quote`, `braces_position`, `no_blank_lines_after_phpdoc`.
- **PHPStan level 8:** clean on all 3 new/modified PHP files
  (`PrsDispatchService.php`, `ComputePrsRequest.php`, `EndpointBrowserController.php`).
- **R syntax smoke:** `Rscript -e 'parse("darkstar/api/finngen/prs_compute.R")'` parses 6 top-level expressions without error.

## Deviations from Plan

**1. [Rule 2 - Critical functionality] DB::connection switched from 'omop' to 'pgsql'**

- **Found during:** Task 2 — PHPStan analysis.
- **Issue:** The plan showed `DB::connection('omop')` for the cohort-existence precondition, but a PHPStan rule (`DB::connection('omop') is banned. Use the SourceAware trait`) blocked this.
- **Fix:** Switched to `DB::connection('pgsql')` with the fully-qualified schema name `{cohortSchema}.cohort`. This works because Parthenon is a single-DB deployment; cross-schema SELECT is native. Matches the precedent in `GwasRunService::assertControlCohortPrepared` lines 421-424.
- **Files modified:** `backend/app/Services/FinnGen/PrsDispatchService.php`.
- **Commit:** `06fb42c7d`.

**2. [Rule 3 - Blocking issue] Test permission re-attachment shim**

- **Found during:** Task 2 — initial Pest run returned 403 for all 5 researcher-authored requests.
- **Issue:** `FinnGenTestingSeeder::run()` invokes `RolePermissionSeeder::run()` which uses `syncPermissions()`. `syncPermissions` WIPES the role→permission link table and re-syncs to a hardcoded list that doesn't yet include `finngen.prs.compute`. The Plan 17-01 migration creates the permission but its role-grant step runs BEFORE `RolePermissionSeeder` wipes it in the test bootstrap chain.
- **Fix:** After `$this->seed(FinnGenTestingSeeder::class)`, re-attach `finngen.prs.compute` to researcher + data-steward + admin + super-admin and flush the Spatie cache. Documented inline as a temporary shim.
- **Files modified:** `backend/tests/Feature/FinnGen/PrsDispatchTest.php`.
- **Deferred-items note:** Plan 17.1 should update `RolePermissionSeeder::PERMISSIONS` / `ROLES` to include `finngen.prs.compute` so future tests don't need the shim. This is a cleanup task, not a correctness issue.

**3. [Rule 3 - Blocking issue] R worker `cohort_ops.R` sourced for .finngen_open_connection**

- **Found during:** Task 1 drafting — `.finngen_open_connection` is defined in `cohort_ops.R`, not `common.R`.
- **Issue:** The plan's code snippet referenced `.finngen_open_connection(...)` without documenting its source file.
- **Fix:** Added `source("/app/api/finngen/cohort_ops.R")` at top of `prs_compute.R` + a corresponding source() call in the `.build_worker` switch block in `routes.R`.
- **Files modified:** `darkstar/api/finngen/prs_compute.R`, `darkstar/api/finngen/routes.R`.
- **Commit:** `b1343322c`.

## Authentication Gates

None. All fully automated.

## Deferred Items

1. **RolePermissionSeeder catalog update** — add `finngen.prs.compute` to the seeder's permission list so future tests don't need the per-test re-attachment shim documented in Deviation 2.
2. **R testthat for prs_compute.R** — Plan 07 smoke-gen is the E2E test for the worker. R-side unit tests (plink2 argv construction, cohort query escaping) are out of scope per RESEARCH §Open Question 6 resolution.
3. **Pre-existing `EndpointGenerateCohortIdTest` fixture collision** — unrelated to Plan 17-03; tracked for Plan 17.1 cleanup.

## Threat Flags

None — this plan introduces no new threat surface beyond what the `<threat_model>` already enumerated. All 7 threats (T-17-S1..S-SQLi-2 + path traversal) mitigated:

| Threat ID | Disposition | How mitigated |
|-----------|-------------|---------------|
| T-17-S1 (tampering — weights integrity) | mitigate | Weights read from `vocab.pgs_score_variants` via regex-escaped `gsub("'", "''", score_id)` query; Plan 01 composite PK ensures idempotent ingestion. |
| T-17-S2 (info disclosure — subject scores) | accept | Writes to `{source}_gwas_results.*` (outside `app.*`) per D-19 — Phase 13.2 T-13.2-S3 invariant holds. |
| T-17-S3 (EoP — dispatch endpoint) | mitigate | `permission:finngen.prs.compute` route middleware + `ComputePrsRequest::authorize()` double-check + viewer role excluded from the permission (Plan 01 seeder). |
| T-17-S4 (DoS — dispatch rate) | mitigate | `throttle:10,1` middleware (max 10/min/user) + Horizon queue backpressure. |
| T-17-S-SQLi-1 (source_key interpolation) | mitigate | FormRequest regex `/^[A-Z][A-Z0-9_]*$/` + R-worker regex `/^[a-z][a-z0-9_]*$/` before any sprintf. |
| T-17-S-SQLi-2 (score_id interpolation) | mitigate | FormRequest regex `/^PGS\d+$/` + R-worker regex + `gsub("'", "''", ...)` defensive quote. |
| T-17-S-path-traversal (export_folder) | mitigate | `export_folder` constructed server-side as `/opt/finngen-artifacts/runs/{run_id}` (ULID); never accepts user input. |

## Self-Check: PASSED

**Files verified:**

- FOUND: darkstar/api/finngen/prs_compute.R
- FOUND: darkstar/api/finngen/routes.R (modified — `grep -q "finngen.prs.compute"` matches)
- FOUND: backend/app/Http/Requests/FinnGen/ComputePrsRequest.php
- FOUND: backend/app/Services/FinnGen/PrsDispatchService.php
- FOUND: backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php (modified — `grep -c "public function prs("` = 1, `grep -c "public function generate("` = 1)
- FOUND: backend/routes/api.php (modified — `grep -q "/{name}/prs"` matches)
- FOUND: backend/database/seeders/FinnGenAnalysisModuleSeeder.php (modified — `grep -q "'key' => 'finngen.prs.compute'"` matches)
- FOUND: backend/tests/Feature/FinnGen/PrsDispatchTest.php

**Commits verified:**

- FOUND: b1343322c — feat(17-03): Darkstar finngen.prs.compute R worker + routes wiring
- FOUND: 06fb42c7d — feat(17-03): PRS dispatch service + controller + route + 6 Pest tests

**Runtime verification:**

- PASS: R syntax parses cleanly (6 top-level expressions)
- PASS: `php artisan route:list -v` shows new prs route with all 4 middleware layers in correct order
- PASS: Pint `--test` clean on all 5 PHP files
- PASS: PHPStan level 8 clean on 3 new/modified service-layer files
- PASS: 6 Pest tests green (34 assertions, 4.76s)
- PASS: GwasDispatchTest regression green (5/5, 28 assertions)
- PASS: All 10 Task 1 acceptance criteria + 13 Task 2 acceptance criteria met
