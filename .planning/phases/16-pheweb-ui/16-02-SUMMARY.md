---
phase: 16-pheweb-ui
plan: 02
subsystem: api
tags: [backend, laravel, api, controller, form-request, genomics, redis-cache, highsec]

requires:
  - phase: 16-01
    provides: ManhattanAggregationService + GencodeService + LoadGencodeGtfCommand
provides:
  - GET /api/v1/finngen/runs/{run}/manhattan (thinned genome-wide, Redis-cached 24h)
  - GET /api/v1/finngen/runs/{run}/manhattan/region (full-resolution <=2Mb window, uncached)
  - GET /api/v1/gencode/genes (GENCODE v46 gene-track, Redis-cached 7d)
  - ManhattanQueryRequest + ManhattanRegionQueryRequest (FormRequest validation + DoS guards)
  - GwasManhattanController + GencodeController (HIGHSEC §2 three-layer model)
  - Pest feature coverage for auth/permission/ownership/status/validation invariants
affects: [16-03, 16-04, 16-05]

tech-stack:
  added: []
  patterns:
    - "HIGHSEC §2 three-layer route protection (auth:sanctum + permission + ownership)"
    - "Cache::remember with server-constructed key (no user-controlled string fragments)"
    - "FormRequest after() hook for cross-field DoS guard (window size)"
    - "Status-switch controller pattern: queued/running → 202+Retry-After, failed → 410, succeeded → 200"

key-files:
  created:
    - backend/app/Http/Controllers/Api/V1/FinnGen/GwasManhattanController.php
    - backend/app/Http/Controllers/Api/V1/GencodeController.php
    - backend/app/Http/Requests/FinnGen/ManhattanQueryRequest.php
    - backend/app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php
    - backend/tests/Feature/FinnGen/GwasManhattanControllerTest.php
    - backend/tests/Feature/FinnGen/GwasManhattanRegionTest.php
    - backend/tests/Feature/FinnGen/ManhattanRoutePermissionTest.php
    - backend/tests/Feature/GencodeControllerTest.php
  modified:
    - backend/routes/api.php (+17 LOC; 3 new routes + 2 use imports)

key-decisions:
  - "Tightened chrom regex from plan's /^(\\d{1,2}|X|Y|MT)$/ to /^([1-9]|1\\d|2[0-2]|X|Y|MT)$/ to reject '23' and other out-of-range two-digit values (Rule 1 deviation)"
  - "Region endpoint intentionally NOT cached — small windows (<=2Mb) always live, caching would bloat Redis without paying off for the common click-through-to-peak UX"
  - "Status-handling extended over plan spec: canceled also returns 410 (parity with failed), other non-SUCCEEDED statuses return 409 (defensive fallthrough)"
  - "Region endpoint applies the SAME status switch as show() — in-flight runs return 202, not 500, so the UI can hold the regional drawer open and poll"

patterns-established:
  - "Ownership check helper `assertOwnershipOrAdmin(FormRequest, Run)` — reusable across Plan 03 top-variants + future per-run endpoints"
  - "Gencode window guard (5Mb) > manhattan region guard (2Mb) — reflects that gene rows are lightweight metadata while variant rows are per-SNP payloads"

requirements-completed: [GENOMICS-04, GENOMICS-13]

duration: 45min
completed: 2026-04-19
---

# Phase 16 Plan 02: Manhattan + Regional + GENCODE HTTP Surface Summary

**Authenticated, permission-gated, rate-limited HTTP endpoints that convert Plan 01's ManhattanAggregationService + GencodeService into the 3 routes the Phase 16 PheWeb-lite UI will consume, with full HIGHSEC §2 three-layer protection and Redis caching where it pays off.**

## What Was Built

### Routes (3 new)

| Method | Path                                            | Middleware                                                              | Controller                       |
| ------ | ----------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| GET    | `/api/v1/finngen/runs/{run}/manhattan`          | `auth:sanctum` + `permission:finngen.workbench.use` + `throttle:120,1` | `GwasManhattanController::show`   |
| GET    | `/api/v1/finngen/runs/{run}/manhattan/region`   | `auth:sanctum` + `permission:finngen.workbench.use` + `throttle:120,1` | `GwasManhattanController::region` |
| GET    | `/api/v1/gencode/genes`                         | `auth:sanctum` + `permission:cohorts.view` + `throttle:120,1`           | `GencodeController::index`        |

All three inherit `auth:sanctum` + `source.resolve` from the outer `Route::prefix('v1')` group at `backend/routes/api.php:186`. The finngen routes live inside the existing `Route::prefix('finngen')` group (next to Phase 15's endpoints routes); the gencode route is a new top-level `Route::prefix('gencode')` group — not under finngen because GENCODE is generic reference data, not a FinnGen concept.

### Controllers

- **`GwasManhattanController`** (150 LOC) — `show()` + `region()` endpoints. Constructor-injected `ManhattanAggregationService`. Private `assertOwnershipOrAdmin()` helper consolidates HIGHSEC §2 Layer 3. Status-switch ladder: queued/running → 202 + `Retry-After: 30`, failed/canceled → 410, succeeded → 200 with the D-04 payload, anything else → 409.
- **`GencodeController`** (81 LOC) — single `index()` endpoint. Constructor-injected `GencodeService`. Validation inlined via `$request->validate()` (simple flat schema, no need for a dedicated FormRequest class). 5 Mb window guard after validation passes.

### FormRequests

- **`ManhattanQueryRequest`** — `bin_count` nullable integer 10–500 (D-27 DoS guard), `thin_threshold` nullable numeric between 1e-10 and 1e-2 (realistic GWS floor to liberal suggestive). `authorize()` re-asserts `finngen.workbench.use` as belt-and-suspenders behind the route middleware.
- **`ManhattanRegionQueryRequest`** — chrom regex, start/end integers, end > start. `after()` hook rejects windows > 2_000_000 bp (T-16-S4).

### Redis Cache Keys Registered

```
finngen:manhattan:{run_id}:thin:{bin_count}              TTL 24h  (thinned whole-genome)
finngen:gencode:genes:{chrom}:{start}:{end}:{include}    TTL  7d  (static reference data)
```

Region endpoint is uncached by design — each regional view is a distinct <=2 Mb slice and users typically click through multiple peaks in quick succession, so cache hits are rare and the cache would bloat without payoff.

Every key fragment is server-constructed from validated integers, a tight chrom regex, or a known run ULID. No user-controlled string is ever concatenated into a key (T-16-S2 cache-poisoning mitigation).

## Test Coverage

31 Pest assertions across 4 feature test files, all green:

| Test file                          | Coverage                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `GwasManhattanControllerTest.php`  | 401 unauth, 403 no-permission, 403 non-owner, 404 missing run, 404 unregistered source_key, 202+Retry-After for queued/running (2 separate tests), 410 failed, 422 bin_count clamp (1/9/501/10000), 200 D-04 envelope shape |
| `GwasManhattanRegionTest.php`      | chrom regex accept (X, MT) / reject (23, chr1, end<=start), 422 window>2Mb, 200 full-res payload shape, 401 unauth, 403 non-owner |
| `GencodeControllerTest.php`        | 401 unauth, 200 for viewer (cohorts.view), chrom regex reject (chr17), range match excluding pseudogenes, include_pseudogenes=1 override, empty-range → `[]`, 422 window>5Mb |
| `ManhattanRoutePermissionTest.php` | HIGHSEC §2 dataset sweep: every finngen Wave-2 route → 401 unauth + 403 viewer; gencode asymmetry check (viewer NOT 403 because viewer has cohorts.view) |

### Success Criteria Matrix

| SC    | Covered by                                                         | Status |
| ----- | ------------------------------------------------------------------ | ------ |
| SC-1  | `GwasManhattanControllerTest::it returns 200 with D-04 envelope`   | green  |
| SC-2  | `GwasManhattanRegionTest::it returns full-resolution variants`     | green  |

### Threat Register Coverage

| Threat ID  | Disposition | Test                                                                 |
| ---------- | ----------- | -------------------------------------------------------------------- |
| T-16-S1    | mitigate    | Plan 01 service whitelists schema + Plan 02 never accepts schema param |
| T-16-S2    | mitigate    | `bin_count clamp` test + server-only key construction                |
| T-16-S4    | mitigate    | `rejects window > 2 Mb` test                                          |
| T-16-S8    | mitigate    | `403 when run belongs to a different user` test                      |
| T-16-S12   | accept      | GET-only + Sanctum — no state mutation                               |
| T-16-S13   | mitigate    | Plan 01 `resolveSchemaForRun` uses information_schema pre-check     |
| T-16-S1b   | accept      | GencodeController reads local TSV only; no outbound HTTP             |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Tightened chrom regex to reject out-of-range two-digit values**
- **Found during:** Task 2 GREEN run (`GwasManhattanRegionTest::it rejects chrom="23"` failed with 200 instead of 422).
- **Issue:** The plan's `/^(\d{1,2}|X|Y|MT)$/` regex accepts any 1–2 digit number, including invalid human chromosomes like `23`, `42`, `99`. The plan's OWN test (`it rejects chrom="23"`) correctly expected a 422 for `23`, exposing the regex bug.
- **Fix:** Tightened to `/^([1-9]|1\d|2[0-2]|X|Y|MT)$/` — matches 1-9, 10-19, 20-22, X, Y, MT. Same fix applied to `GencodeController` validation (both controllers accept chrom from the query string).
- **Files modified:** `backend/app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php`, `backend/app/Http/Controllers/Api/V1/GencodeController.php`.
- **Commit:** `8311b0f27` (GREEN commit includes the corrected regex).

**2. [Rule 3 — Blocker] Fixture timestamp requirement for terminal Run statuses**
- **Found during:** Initial RED run — `QueryException SQLSTATE[23514]: Check violation: finngen_runs_terminal_requires_finished_at`.
- **Issue:** The `finngen.runs` table has a CHECK constraint requiring `finished_at NOT NULL` when status is terminal (succeeded/failed/canceled). The plan's sample test fixtures omitted `finished_at`, causing every ownership / in-flight / status test to throw before reaching the controller.
- **Fix:** Added `started_at` + `finished_at` to every `Run::create` call for terminal statuses in the 3 test files that seed Run rows directly.
- **Files modified:** the 3 Pest test files (fixture hygiene, not controller/service behavior).
- **Commit:** folded into `457fa88c8` (RED) — did not warrant a separate "test infra" commit.

### Extended Beyond Plan

- **Region endpoint status switch** — the plan's sketch returned 409 for non-SUCCEEDED runs in `region()`; we extended to return 202+Retry-After for queued/running (parity with `show()`) and 410 for failed/canceled. This gives the regional-view drawer a consistent polling contract with the top-level Manhattan.
- **Canceled-run handling** — plan enumerated only succeeded/failed/queued/running; we treat `canceled` the same as `failed` (410) because the UX consequence is identical (a terminal-not-useful run).

## Auth Gates

None — both endpoints are standard Sanctum-authenticated API calls. No external service auth, no 2FA, no email verification.

## Curl Examples (for Plan 04/05 frontend hooks)

```bash
# Thinned Manhattan (Plan 04 useManhattanData hook target)
curl -H "Authorization: Bearer $TOKEN" \
  "https://parthenon.acumenus.net/api/v1/finngen/runs/01JFAKE.../manhattan?bin_count=100"

# Regional view — peak at chr17:7_668_421 ± 500 kb (Plan 05 RegionalView)
curl -H "Authorization: Bearer $TOKEN" \
  "https://parthenon.acumenus.net/api/v1/finngen/runs/01JFAKE.../manhattan/region?chrom=17&start=7168421&end=8168421"

# Gene track (Plan 05 GeneTrack hook)
curl -H "Authorization: Bearer $TOKEN" \
  "https://parthenon.acumenus.net/api/v1/gencode/genes?chrom=17&start=7168421&end=8168421"
```

## Verification Commands Run

```
docker compose exec -T php vendor/bin/pest \
  tests/Feature/FinnGen/GwasManhattanControllerTest.php \
  tests/Feature/FinnGen/GwasManhattanRegionTest.php \
  tests/Feature/GencodeControllerTest.php \
  tests/Feature/FinnGen/ManhattanRoutePermissionTest.php --no-coverage
# Tests: 31 passed (74 assertions)  Duration: 22.87s

docker compose exec -T php vendor/bin/pint \
  app/Http/Controllers/Api/V1/FinnGen/GwasManhattanController.php \
  app/Http/Controllers/Api/V1/GencodeController.php \
  app/Http/Requests/FinnGen/ManhattanQueryRequest.php \
  app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php \
  tests/Feature/FinnGen/...
# PASS 8 files

docker compose exec -T php vendor/bin/phpstan analyse --level=8 \
  app/Http/Controllers/Api/V1/FinnGen/GwasManhattanController.php \
  app/Http/Controllers/Api/V1/GencodeController.php \
  app/Http/Requests/FinnGen/ManhattanQueryRequest.php \
  app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php
# [OK] No errors

docker compose exec -T php php artisan route:list --path=finngen/runs | grep manhattan
# 2 rows (manhattan + manhattan/region)

docker compose exec -T php php artisan route:list --path=gencode
# 1 row (gencode.genes)
```

## Commits

| Commit       | Type | Description                                                            |
| ------------ | ---- | ---------------------------------------------------------------------- |
| `457fa88c8`  | test | add failing Manhattan + region + gencode controller tests (RED)        |
| `8311b0f27`  | feat | GwasManhattanController + GencodeController + 3 routes (GREEN)         |

## Self-Check: PASSED

Verified:
- `backend/app/Http/Controllers/Api/V1/FinnGen/GwasManhattanController.php` — FOUND
- `backend/app/Http/Controllers/Api/V1/GencodeController.php` — FOUND
- `backend/app/Http/Requests/FinnGen/ManhattanQueryRequest.php` — FOUND
- `backend/app/Http/Requests/FinnGen/ManhattanRegionQueryRequest.php` — FOUND
- `backend/tests/Feature/FinnGen/GwasManhattanControllerTest.php` — FOUND
- `backend/tests/Feature/FinnGen/GwasManhattanRegionTest.php` — FOUND
- `backend/tests/Feature/FinnGen/ManhattanRoutePermissionTest.php` — FOUND
- `backend/tests/Feature/GencodeControllerTest.php` — FOUND
- Commit `457fa88c8` — FOUND
- Commit `8311b0f27` — FOUND
- Routes via `php artisan route:list` — 2 manhattan + 1 gencode FOUND
