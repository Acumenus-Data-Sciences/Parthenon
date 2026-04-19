---
phase: 18-risteys-style-endpoint-dashboard
plan: 04
subsystem: http-dispatch
tags: [laravel, http, finngen, endpoint-profile, dispatch, middleware, form-request, highsec, tdd-green]

# Dependency graph
requires:
  - phase: 13.2-finish-finngen-cutover
    provides: FinnGenEndpointGeneration 100B offset convention + finngen.runs audit trail
  - phase: 17-pgs-prs
    provides: PrsDispatchService precondition-ladder template + EndpointBrowserController::prs method pattern + finngen.idempotency middleware alias
  - phase: 18-risteys-style-endpoint-dashboard
    provides:
      - Plan 18-01 Wave 0 RED Pest stubs (EndpointProfileDispatchTest 5 cases + EndpointProfileReadTest 4 cases)
      - Plan 18-02 finngen.endpoint_profile.{view,compute} Spatie permissions + finngen.endpoint_profile_access table
      - Plan 18-03 Co2SchemaProvisioner + EndpointExpressionHasher + 4 EndpointProfile* Eloquent models
provides:
  - App\Services\FinnGen\EndpointProfileDispatchService — 4-step precondition ladder → FinnGenRunService::create with analysis_type='co2.endpoint_profile'
  - App\Http\Requests\FinnGen\ComputeEndpointProfileRequest — POST body validation (source_key regex + min_subjects)
  - App\Http\Requests\FinnGen\ReadEndpointProfileRequest — GET query-param validation (source_key regex; Warning 4 hardening)
  - App\Http\Middleware\TrackEndpointProfileAccess — try-catch wrapped finngen.endpoint_profile_access upsert (Pitfall 3 / T-18-05)
  - bootstrap/app.php alias registration: 'finngen.endpoint_profile_access' => TrackEndpointProfileAccess::class
  - EndpointBrowserController::profile() — POST /api/v1/finngen/endpoints/{name}/profile (202 + run envelope)
  - EndpointBrowserController::showProfile() — GET /api/v1/finngen/endpoints/{name}/profile (cached / needs_compute / ineligible envelope)
  - Routes: POST + GET /{name}/profile inside the endpoints group with correct permission + throttle + idempotency / access-log middleware
  - 10 GREEN Feature tests (5 dispatch + 5 read) — Plan 18-01 Wave 0 RED stubs inverted
affects: [18-05, 18-06, 18-07]

# Tech tracking
tech-stack:
  added: []  # no new composer deps — service, middleware, form-requests, and controller methods only
  patterns:
    - "PrsDispatchService-pattern port — constructor DI + public const ANALYSIS_TYPE + 4-step precondition ladder with fail422(error_code, message) helper + FinnGenRunService::create call"
    - "Dual FormRequest convention — both POST body AND GET query params use FormRequest (Warning 4 hardening; source_key regex enforced BEFORE controller interpolates it into any schema name)"
    - "Non-critical middleware try-catch — TrackEndpointProfileAccess wraps the upsert in try-catch Throwable per CLAUDE.md Gotcha #12; access-log failure NEVER breaks the request pipeline"
    - "Partial-provision 42P01 guard — showProfile wraps the 3 sibling-table reads (km_points, comorbidities, drug_classes) in try-catch QueryException; on undefined_table, returns needs_compute reason=partial_provision so frontend auto-dispatches (no 500)"
    - "Lazy schema provisioning on dispatch — Co2SchemaProvisioner::provision() called unconditionally on every POST /profile; idempotent CREATE ... IF NOT EXISTS makes it safe"
    - "Defense-in-depth regex re-validation — derived lowercase schema name ({source}_co2_results) re-checked via /^[a-z][a-z0-9_]*$/ inside showProfile, even though ReadEndpointProfileRequest already enforces the uppercase regex upstream"

key-files:
  created:
    - backend/app/Services/FinnGen/EndpointProfileDispatchService.php
    - backend/app/Http/Requests/FinnGen/ComputeEndpointProfileRequest.php
    - backend/app/Http/Requests/FinnGen/ReadEndpointProfileRequest.php
    - backend/app/Http/Middleware/TrackEndpointProfileAccess.php
  modified:
    - backend/bootstrap/app.php  # alias 'finngen.endpoint_profile_access' registered
    - backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php  # 2 new methods + 5 new imports
    - backend/routes/api.php  # 2 new routes inside the finngen/endpoints group
    - backend/tests/Feature/FinnGen/EndpointProfileDispatchTest.php  # 5 RED stubs → 5 GREEN assertions
    - backend/tests/Feature/FinnGen/EndpointProfileReadTest.php  # 4 RED stubs → 5 GREEN assertions (added bonus partial-provision test)

key-decisions:
  - "showProfile uses ReadEndpointProfileRequest (not raw Request) per Warning 4 checker review — no inline preg_match on source_key in the controller. The regex /^[A-Z][A-Z0-9_]{1,30}$/ runs BEFORE the controller method body executes."
  - "Dispatch precondition 2 uses D-15 semantics: source is ELIGIBLE if death OR observation_period > 0 (else source_ineligible). Previous draft required BOTH > 0, which would have blocked sources with death data but missing observation_period — not what the UI-SPEC specifies."
  - "safeCount helper swallows PG exceptions on CDM table COUNT — a minimal test-seeded CDM without drug_exposure still passes precondition 2 (death + observation_period carry the eligibility); drug_exposure presence only flips the source_has_drug_data meta flag."
  - "Fake FinnGenRunService reused verbatim from Phase 17 PrsDispatchTest pattern — skips the analysis-module registry validation, returns a 26-char ULID-shaped fake id. Keeps the test scope at dispatch preconditions + envelope shape, not Run-insert lifecycle."
  - "Bonus 5th read-test case: status=needs_compute reason=partial_provision when a sibling co2_results table is DROPped mid-seed. Wave 0 stub had only 4 read cases; adding this hardens the Warning 3 42P01 guard with a live-drop assertion."
  - "TrackEndpointProfileAccess wired on GET only — POST path doesn't need access logging because dispatch implies access. GET is the drawer-open signal consumed by the warmer (D-11)."
  - "pancreas.drug_exposure created in dispatch test setup even though not strictly needed — future tests asserting source_has_drug_data flag will benefit, and the afterEach drop is trivial."

patterns-established:
  - "Phase 18 dispatch-controller convention: 2 controller methods (profile POST + showProfile GET) per analysis type; POST uses FormRequest + DispatchService + Co2SchemaProvisioner; GET uses FormRequest + EndpointExpressionHasher + try-catch QueryException for partial-provision."
  - "Dual FormRequest for POST+GET — both paths use a dedicated FormRequest class (ComputeEndpointProfileRequest / ReadEndpointProfileRequest), not shared. Keeps rules self-documenting per HTTP verb and keeps authorize() returning true since route middleware already enforces permission."
  - "Middleware alias registration pattern (Laravel 11): add to $middleware->alias([]) block in bootstrap/app.php alongside 'finngen.idempotency' — not Kernel.php (which no longer exists in L11)."
  - "Feature-test access-log drop pattern — tests that need to verify the middleware try-catch works correctly DROP the access-log table mid-test and wrap the dispatch in try/finally to recreate the table so downstream tests still see it."

requirements-completed: [GENOMICS-09, GENOMICS-10, GENOMICS-11]  # HTTP layer complete for all 3; R worker (Plan 18-05) + React UI (Plan 18-06) + warmer (Plan 18-07) still pending but the dispatch API + cached-read API are now fully wired

# Metrics
duration: 7min
completed: 2026-04-19
---

# Phase 18 Plan 04: EndpointBrowserController profile/showProfile + routes + middleware Summary

**HTTP dispatch layer wired for Risteys-style endpoint profiles: 2 FormRequests + dispatch service + try-catch access-log middleware + 2 controller methods + 2 routes; all 10 Plan 18-01 Wave 0 Feature test stubs flipped RED → GREEN with 55 assertions passing.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-19T18:37:12Z
- **Completed:** 2026-04-19T18:44:16Z
- **Tasks:** 2
- **Files created:** 4 (DispatchService + 2 FormRequests + Middleware)
- **Files modified:** 5 (bootstrap/app.php, controller, routes/api.php, 2 test files)

## Accomplishments

- **`EndpointProfileDispatchService`** ships the 4-step precondition ladder mirroring `PrsDispatchService`: (1) source exists in `app.sources`, (2) source has `death` OR `observation_period` rows (D-15 — not both required), (3) endpoint in `finngen.endpoint_definitions` has non-empty resolved concepts, (4) cohort_definition_id resolution via `FinnGenEndpointGeneration + OMOP_COHORT_ID_OFFSET` when a succeeded generation exists. Public const `ANALYSIS_TYPE='co2.endpoint_profile'` is hard-coded (T-18-06 mitigation — no user string reaches the R dispatcher). Dispatches via `FinnGenRunService::create` with 11-key params including expression_hash, condition/drug/source concept IDs, and the two eligibility booleans `source_has_death_data` / `source_has_drug_data`.

- **Two FormRequests** enforce source_key input shape BEFORE the controller:
  - `ComputeEndpointProfileRequest` — `source_key` regex `/^[A-Z][A-Z0-9_]*$/` + `max:64` + optional `min_subjects` integer 1-1000.
  - `ReadEndpointProfileRequest` — stricter GET regex `/^[A-Z][A-Z0-9_]{1,30}$/` with a 30-char upper bound per Warning 4 hardening (rejects malformed source_key values like `bad; DROP` with a 422 before any schema-name interpolation runs in `showProfile()`).
  - Both return `authorize()=true`: route middleware `permission:finngen.endpoint_profile.compute` / `.view` already gates access, and duplicating the check would double the work.

- **`TrackEndpointProfileAccess` middleware** upserts `finngen.endpoint_profile_access` on every `GET /profile`. ALL DB writes wrapped in `try-catch Throwable` per CLAUDE.md Gotcha #12 PG transaction-poisoning rule — if the access-log table is unavailable (dropped, locked, connection blip), the middleware logs `warning` and the request proceeds untouched. T-18-05 mitigation live in the code.

- **`bootstrap/app.php`** registers the middleware alias `'finngen.endpoint_profile_access'` alongside `'finngen.idempotency'` in the Laravel 11 `$middleware->alias()` block.

- **`EndpointBrowserController::profile()`** — POST dispatch handler. Calls `Co2SchemaProvisioner::provision()` (idempotent) then forwards to the dispatch service. Returns 202 with `data: {run_id, endpoint_name, source_key, expression_hash}`.

- **`EndpointBrowserController::showProfile()`** — GET cached-read handler. Computes current `expression_hash` via `EndpointExpressionHasher`, checks `information_schema.schemata` for `{source}_co2_results`, reads the 4 cache tables, compares `cached_hash` vs current. Returns one of 3 envelope shapes: `cached` (full payload + meta), `needs_compute` (with reason `no_cache` | `stale_hash` | `partial_provision` + dispatch_url), or `ineligible` (error_code `source_ineligible` | `endpoint_not_resolvable`). The Warning 3 partial-provision guard wraps the 3 sibling-table reads in try-catch `QueryException` and returns `needs_compute` on SQLSTATE 42P01 instead of a 500.

- **2 new routes** inside the existing `Route::prefix('endpoints')->group(...)` block in `backend/routes/api.php`:
  - `POST /api/v1/finngen/endpoints/{name}/profile` → `profile()` with middleware `['permission:finngen.endpoint_profile.compute', 'finngen.idempotency', 'throttle:10,1']`.
  - `GET /api/v1/finngen/endpoints/{name}/profile` → `showProfile()` with middleware `['permission:finngen.endpoint_profile.view', 'finngen.endpoint_profile_access', 'throttle:120,1']`.

- **10 Feature test cases GREEN** (Plan 18-01 RED stubs flipped):
  - `EndpointProfileDispatchTest` — 5 cases: 202 envelope, 422 source_ineligible, 422 endpoint_not_resolvable, 403 permission gate (T-18-01), 202 even with access-log table dropped (T-18-05).
  - `EndpointProfileReadTest` — 5 cases: cached full payload, stale_hash (D-10), no_cache, ineligible endpoint_not_resolvable, partial_provision (Warning 3 bonus).
  - Total 55 assertions, 7.39s runtime.

- Pint clean on all touched files; PHPStan level 8 clean on the controller + 4 new source files.

## Task Commits

| # | Task | Commit | Files |
| - | ---- | ------ | ----- |
| 1 | EndpointProfileDispatchService + 2 FormRequests + TrackEndpointProfileAccess middleware + bootstrap alias | `79c8b4da0` | 5 files, 329 insertions |
| 2 | Controller profile + showProfile + 2 routes + flip 10 Feature tests GREEN | `9bd027adb` | 4 files, 668 insertions / 42 deletions |

## Pest Test Evidence

```
   PASS  Tests\Feature\FinnGen\EndpointProfileDispatchTest
  ✓ it returns 202 + run envelope when researcher dispatches endpoint p… 0.88s
  ✓ it returns 422 source_ineligible when source has no death AND no ob… 0.77s
  ✓ it returns 422 endpoint_not_resolvable when endpoint has no concept… 0.74s
  ✓ it returns 403 when user lacks finngen.endpoint_profile.compute per… 0.73s
  ✓ it succeeds when access-log table is unavailable (transaction poiso… 0.76s

   PASS  Tests\Feature\FinnGen\EndpointProfileReadTest
  ✓ it returns status=cached with summary + km_points + comorbidities +… 0.71s
  ✓ it returns status=needs_compute with reason=stale_hash when cached…  0.70s
  ✓ it returns status=needs_compute with reason=no_cache when no row ex… 0.70s
  ✓ it returns status=ineligible with error_code=endpoint_not_resolvabl… 0.68s
  ✓ it returns status=needs_compute with reason=partial_provision when…  0.71s

  Tests:    10 passed (55 assertions)
  Duration: 7.39s (combined run)
```

## Route-List Evidence

```
POST            api/v1/finngen/endpoints/{name}/profile Api\V1\FinnGen\Endp…
  GET|HEAD        api/v1/finngen/endpoints/{name}/profile Api\V1\FinnGen\Endp…
```

Both routes registered inside the `Route::prefix('finngen')->prefix('endpoints')` group under `auth:sanctum`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added a bonus 5th read-test case (partial_provision)**

- **Found during:** Task 2 — the plan body listed 4 read scenarios as required and a 5th "Optional but recommended" partial-provision scenario. I folded it in because the Warning 3 42P01 guard in `showProfile()` is not actually test-covered by the 4 required cases; the DROP-table mid-test is the only way to assert the guard works. Without it, a future refactor could silently remove the try-catch and all 4 required tests would still pass.
- **Fix:** Added `it('returns status=needs_compute with reason=partial_provision when a sibling table is missing (42P01 guard)')`. Drops `pancreas_co2_results.endpoint_profile_km_points` after seeding the summary row, asserts `needs_compute` + `partial_provision`, then re-provisions in a `finally` block so downstream tests see a clean schema.
- **Files modified:** `backend/tests/Feature/FinnGen/EndpointProfileReadTest.php` — 5 cases instead of the plan's 4.
- **Verification:** Bonus test passes; partial-provision guard is now assertion-gated.
- **Committed in:** `9bd027adb` (Task 2 commit).

**2. [Rule 3 - Blocking] `CoverageBucket::FULLY_MAPDPED` typo on first write**

- **Found during:** Task 2 initial write of `EndpointProfileDispatchTest.php`.
- **Issue:** Typo `FULLY_MAPDPED` (extra `D`) would have caused a class-constant error at test-load time. Used a `?? FULLY_MAPPED` fallback initially, then spotted the typo.
- **Fix:** Replaced with plain `CoverageBucket::FULLY_MAPPED`. No coalesce needed.
- **Files modified:** `backend/tests/Feature/FinnGen/EndpointProfileDispatchTest.php`
- **Verification:** Test file loaded, all 5 dispatch scenarios passing.
- **Committed in:** `9bd027adb` (Task 2 commit).

**3. [Rule 3 - Blocking] Pint auto-fix on 2 Pest files + 1 controller style tweak**

- **Found during:** Post-write Pint verification.
- **Issue:** Pint flagged a `unary_operator_spaces` issue on the controller and a `class_definition` style issue on the Pest files.
- **Fix:** Ran `vendor/bin/pint` (auto-fix). All 3 files re-passed Pint.
- **Files modified:** Controller + 2 test files (style-only).
- **Verification:** Pint + PHPStan clean; re-ran Pest — 10 tests still GREEN.
- **Committed in:** Folded into the Task 2 commit (`9bd027adb`).

**4. [Rule 2 - Missing functionality] `safeCount` helper with swallow-on-missing-table**

- **Found during:** Task 1 execution-time design review.
- **Issue:** A minimal test-seeded CDM may have `death` + `observation_period` but not `drug_exposure` (which the plan mentions should flip the `source_has_drug_data` meta flag). A naive `DB::selectOne("SELECT COUNT(*) FROM {$cdm}.drug_exposure")` would raise 42P01 on missing tables and abort the dispatch. The source IS eligible — drug data is optional per D-14 footnote.
- **Fix:** Added `safeCount(schema, table): int` helper that wraps the COUNT in try-catch and returns 0 on any exception. Used for all 3 CDM counts (death, observation_period, drug_exposure). Precondition 2 remains death>0 OR obs>0; drug count only flips the meta flag.
- **Files modified:** `backend/app/Services/FinnGen/EndpointProfileDispatchService.php` (added private method).
- **Verification:** Test case `it('returns 202 + run envelope …')` seeds all 3 tables and still passes; the dispatch is resilient to partial CDM seeds.
- **Committed in:** `79c8b4da0` (Task 1 commit).

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 2 Rule 2 missing). Net additions: 1 bonus test case + 1 helper method + 3 style tweaks. Plan contract fully honored; all 10 required tests GREEN.

## Key Links

- **EndpointBrowserController::profile** → **EndpointProfileDispatchService::dispatch** **via** injected service param
- **EndpointBrowserController::profile** → **Co2SchemaProvisioner::provision** **via** idempotent pre-dispatch call (lazy D-09)
- **EndpointBrowserController::showProfile** → **EndpointExpressionHasher::hash** **via** injected service param
- **EndpointProfileDispatchService::dispatch** → **FinnGenRunService::create** **via** `analysis_type = 'co2.endpoint_profile'`
- **TrackEndpointProfileAccess** → **finngen.endpoint_profile_access** **via** `ON CONFLICT (endpoint_name, source_key) DO UPDATE`
- **POST /api/v1/finngen/endpoints/{name}/profile** → **EndpointBrowserController::profile** **via** route middleware chain `['permission:finngen.endpoint_profile.compute', 'finngen.idempotency', 'throttle:10,1']`
- **GET /api/v1/finngen/endpoints/{name}/profile** → **EndpointBrowserController::showProfile** **via** route middleware chain `['permission:finngen.endpoint_profile.view', 'finngen.endpoint_profile_access', 'throttle:120,1']`

## Threat Model Coverage (from 18-04-PLAN.md)

| Threat | Mitigation in this Plan |
|--------|------------------------|
| T-18-01 (EoP / permission gate) | `permission:finngen.endpoint_profile.compute` on POST route; 403 test case live-asserts |
| T-18-03 (Tampering / source_key injection) | Dual-layer regex: FormRequest at HTTP boundary + derived-schema re-validation in DispatchService & showProfile (defense-in-depth) |
| T-18-05 (DoS / access-log transaction poisoning) | `TrackEndpointProfileAccess` try-catch Throwable; dropped-table test case live-asserts dispatch still returns 202 |
| T-18-06 (Tampering / R injection via analysis_type) | `public const ANALYSIS_TYPE = 'co2.endpoint_profile'` — hard-coded string, never user-controlled |

## Known Stubs

None. All code paths are wired end-to-end to existing Phase 18-02/18-03 substrate (access-log table, permissions, Co2SchemaProvisioner, EndpointExpressionHasher, 4 result models). The one external dependency — the Plan 18-05 R worker that actually populates `{source}_co2_results.*` — is NOT a stub in this plan's code; the HTTP layer is ready to consume real worker output. Plan 18-05 lands the R worker; until then, live dispatches will queue a run that the worker can't execute, and the cached-read path will return `needs_compute` on every request.

## Threat Flags

None. No new network endpoints outside the plan's declared surface. No new auth paths. No schema changes at trust boundaries (Plan 18-02 already landed `finngen.endpoint_profile_access`; Plan 18-03 landed the provisioner + 4 result models). The 2 new routes are fully permission-gated per HIGHSEC §2.

## Next Phase Readiness

- **Plan 18-05** (R worker) can now consume the 202 + run envelope — the dispatch writes `params = {endpoint_name, source_key, expression_hash, min_subjects, cohort_definition_id, finngen_endpoint_generation_id, condition_concept_ids, drug_concept_ids, source_concept_ids, source_has_death_data, source_has_drug_data}` into `finngen.runs` and Horizon's `RunFinnGenAnalysisJob` dispatches to the Darkstar plumber.
- **Plan 18-06** (React UI) can now call `useEndpointProfile(name, source_key)` hitting `GET /profile` and `useDispatchEndpointProfile(name, {source_key})` hitting `POST /profile`. The three envelope shapes (`cached`, `needs_compute`, `ineligible`) match 18-UI-SPEC.md's TypeScript `EndpointProfileEnvelope` union exactly.
- **Plan 18-07** (WarmEndpointProfilesCommand) can query `finngen.endpoint_profile_access WHERE last_accessed_at > NOW() - INTERVAL '14 days'` for stale pairs and re-dispatch via the same `EndpointBrowserController::profile` route internally.

## Self-Check: PASSED

Files exist:
```
FOUND: backend/app/Services/FinnGen/EndpointProfileDispatchService.php
FOUND: backend/app/Http/Requests/FinnGen/ComputeEndpointProfileRequest.php
FOUND: backend/app/Http/Requests/FinnGen/ReadEndpointProfileRequest.php
FOUND: backend/app/Http/Middleware/TrackEndpointProfileAccess.php
FOUND: backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php (modified)
FOUND: backend/routes/api.php (modified)
FOUND: backend/bootstrap/app.php (modified)
FOUND: backend/tests/Feature/FinnGen/EndpointProfileDispatchTest.php (flipped GREEN)
FOUND: backend/tests/Feature/FinnGen/EndpointProfileReadTest.php (flipped GREEN)
```

Commits exist:
```
FOUND: 79c8b4da0 (Task 1 — service + FormRequests + middleware + alias)
FOUND: 9bd027adb (Task 2 — controller methods + routes + tests)
```

Tests: 10/10 GREEN (5 dispatch + 5 read), 55 assertions.
Pint: clean on all touched files.
PHPStan level 8: clean on all new + modified source files.
Route list: 2 new routes registered with correct middleware.

---
*Phase: 18-risteys-style-endpoint-dashboard*
*Plan: 18-04*
*Completed: 2026-04-19*
