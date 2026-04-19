---
phase: 15
slug: gwas-dispatch-run-tracking-and-generation-history
status: planner_filled
nyquist_compliant: false
sc4_deferred: true
wave_0_complete: false
created: 2026-04-18
planner_filled: 2026-04-18
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from 15-RESEARCH.md §Validation Architecture. Planner has filled the Per-Task Verification Map.

> **SC-4 real E2E smoke deferred** to `15-HUMAN-UAT.md` — see entry for command + evidence checklist. Plan 09 Task 1 (--via-http extension) is complete; Task 2 (real PANCREAS cohort 221 run) is UAT debt pending Phase 14 infrastructure availability. `nyquist_compliant` remains false until the 7-item evidence checklist is captured.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (PHP)** | Pest 3.x on Laravel 11 |
| **Framework (TS)** | Vitest + @testing-library/react |
| **Framework (smoke)** | Laravel Artisan command (finngen:gwas-smoke-test --via-http) |
| **Config file** | `backend/phpunit.xml`, `frontend/vitest.config.ts` |
| **Quick run command (PHP)** | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter=EndpointGwasDispatchTest --parallel"` |
| **Quick run command (TS)** | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-endpoint-browser --reporter=dot"` |
| **Full suite command (PHP)** | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --group=finngen --parallel"` |
| **Full suite command (TS)** | `docker compose exec -T node sh -c "cd /app && npx vitest run"` |
| **E2E smoke** | `docker compose exec -T php php artisan finngen:gwas-smoke-test --via-http --endpoint=E4_DM2 --source=PANCREAS --control-cohort=221` |
| **Estimated runtime (unit/feature)** | ~45 s Pest, ~20 s Vitest |
| **Estimated runtime (E2E smoke)** | ≤ 30 min per ROADMAP SC-4 |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the file touched (Pest filter OR Vitest glob).
- **After every plan wave:** Run the full finngen group (Pest) + Vitest run.
- **Before `/gsd-verify-work`:** Full suite must be green AND E2E smoke must have produced a `succeeded` tracking row on PANCREAS cohort 221.
- **Max feedback latency:** ≤ 60 s for unit/feature; ≤ 30 min for E2E smoke (gated by SC-4).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | GENOMICS-03, GENOMICS-14 | T-15-01 / HIGHSEC §4.1 | `finngen.endpoint_gwas_runs` owned by `parthenon_migrator`; `parthenon_app` has SELECT/INSERT/UPDATE/DELETE; partial expression index on `finngen.runs` exists | integration (psql) | `docker compose exec -T postgres psql -U parthenon -d parthenon -tAc "SELECT has_table_privilege('parthenon_app','finngen.endpoint_gwas_runs','INSERT')"` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 0 | GENOMICS-05 | T-15-03 / HIGHSEC §3.1 | `App\Models\App\FinnGen\EndpointGwasRun` declares `$fillable` (never `$guarded=[]`) | unit | `docker compose exec -T php php artisan tinker --execute="echo (new ReflectionClass(App\\Models\\App\\FinnGen\\EndpointGwasRun::class))->getDefaultProperties()['fillable'] !== null ? 'ok' : 'fail';"` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 0 | GENOMICS-03 | — | 8 typed exception classes exist with readonly context fields | unit | `docker compose exec -T php php artisan tinker --execute='foreach (["DuplicateRunException","RunInFlightException","UnresolvableConceptsException","SourceNotFoundException","EndpointNotMaterializedException","ControlCohortNotPreparedException","CovariateSetNotFoundException","NotOwnedRunException"] as $c) echo class_exists("App\\\\Services\\\\FinnGen\\\\Exceptions\\\\$c") ? "$c ok\\n" : "$c missing\\n";'` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | GENOMICS-03 | T-15-06 | `GwasRunService::dispatchStep2AfterStep1` does NOT call the strict artifact check; threads `step1_run_id` into Darkstar params | unit (Pest) | `docker compose exec -T php vendor/bin/pest tests/Unit/FinnGen --filter=dispatchStep2AfterStep1 --parallel` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | GENOMICS-03 | T-15-04 / T-15-07 | `dispatchFullGwas` runs D-04 ladder first-fail-wins; D-15 two-phase INSERT-dispatch-backfill; Open-Q5 ownership check on overwrite | feature (Pest) | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/EndpointGwasDispatchTest.php --parallel` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 1 | GENOMICS-05 | T-15-05 / CLAUDE.md Gotcha #12 | `FinnGenGwasRunObserver` wraps every DB op in try-catch; zero `throw` statements in the file | unit (Pest) | `docker compose exec -T php vendor/bin/pest tests/Unit/FinnGen/FinnGenGwasRunObserverTest.php --parallel` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 1 | GENOMICS-05 | — | Observer registered via `Run::observe(FinnGenGwasRunObserver::class)` in AppServiceProvider::boot() | unit (grep) | `grep -c 'Run::observe(FinnGenGwasRunObserver::class)' backend/app/Providers/AppServiceProvider.php` | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 2 | GENOMICS-03 | T-15-02 / HIGHSEC §2 | `DispatchEndpointGwasRequest` gates via `can('finngen.workbench.use')`; defensive max:99999999999 on control_cohort_id | unit (Pest) | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/EndpointGwasDispatchTest.php --filter='validates_request_body' --parallel` | ❌ W0 | ⬜ pending |
| 15-04-02 | 04 | 2 | GENOMICS-03, GENOMICS-05, GENOMICS-14 | T-15-04 / T-15-13 / T-15-15 | Controller maps 8 typed exceptions + ModelNotFoundException to 404/422/409/403; show() includes generation_runs + gwas_runs + gwas_ready_sources capped at 100 | feature (Pest) | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/EndpointGwasDispatchTest.php tests/Feature/FinnGen/EndpointDetailGwasRunsTest.php tests/Feature/FinnGen/EndpointDetailGenerationHistoryTest.php --parallel` | ❌ W0 | ⬜ pending |
| 15-04-03 | 04 | 2 | GENOMICS-03 | T-15-02 | Routes registered inside auth:sanctum group with permission:finngen.workbench.use + finngen.idempotency + throttle (10/min POST, 60/min GET) | feature (Pest) | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/EndpointGwasRouteMiddlewareTest.php --parallel` | ❌ W0 | ⬜ pending |
| 15-05-01 | 05 | 3 | GENOMICS-03, GENOMICS-05, GENOMICS-14 | T-15-17 | api.ts exports 7 types + 3 functions matching UI-SPEC verbatim; dispatchGwas throws typed GwasDispatchRefusal on 4xx | unit (tsc) | `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"` | ❌ W0 | ⬜ pending |
| 15-05-02 | 05 | 3 | GENOMICS-03 | — | Hooks invalidate endpoint detail + eligible-controls on dispatch success; staleTimes match UI-SPEC | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-endpoint-browser/__tests__/useDispatchGwas.test.ts"` | ❌ W0 | ⬜ pending |
| 15-06-01 | 06 | 3 | GENOMICS-05 | T-15-17 | RunStatusBadge supports 7 statuses (adds 'superseded') at font-semibold; no font-medium anywhere in Phase 15 UI | unit (grep + vite) | `grep -rc "font-medium" frontend/src/features/finngen-endpoint-browser/components/ frontend/src/features/_finngen-foundation/components/RunStatusBadge.tsx; docker compose exec -T node sh -c "cd /app && npx vite build"` | ❌ W0 | ⬜ pending |
| 15-06-02 | 06 | 3 | GENOMICS-05, GENOMICS-14 | T-15-20 / T-15-21 | GenerationHistorySection + GwasRunsSection render per UI-SPEC §Layout Specification with ARIA, focus rings, superseded muting | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-endpoint-browser/__tests__/GenerationHistorySection.test.tsx src/features/finngen-endpoint-browser/__tests__/GwasRunsSection.test.tsx"` | ❌ W0 | ⬜ pending |
| 15-06-03 | 06 | 3 | GENOMICS-03 | T-15-17 / T-15-19 | RunGwasPanel renders collapsed default; expanded form maps 10 error_codes; focus management on success/error | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-endpoint-browser/__tests__/RunGwasPanel.test.tsx"` | ❌ W0 | ⬜ pending |
| 15-07-01 | 07 | 4 | GENOMICS-03, GENOMICS-05, GENOMICS-14 | — | Drawer renders 3 new sections; legacy inline history removed; GeneratePanel untouched | unit (vite build + grep) | `docker compose exec -T node sh -c "cd /app && npx vite build" && grep -c "GenerationHistorySection\\|GwasRunsSection\\|RunGwasPanel" frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx` | ❌ W0 | ⬜ pending |
| 15-07-02 | 07 | 4 | — | T-15-22 | Phase 16 stub route registered at `/workbench/finngen-endpoints/:name/gwas/:run_id` inside workbench auth wrapper | unit (grep) | `grep -c '/workbench/finngen-endpoints/:name/gwas/:run_id' frontend/src/app/router.tsx` | ❌ W0 | ⬜ pending |
| 15-08-01 | 08 | 5 | GENOMICS-03 | T-15-02 / T-15-04 | 6 Pest feature tests covering dispatch contract, schema, middleware, show() extensions, eligible controls; 14 scenarios in EndpointGwasDispatchTest | integration (Pest) | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/EndpointGwas tests/Feature/FinnGen/EligibleControls tests/Feature/FinnGen/EndpointDetail --parallel` | ❌ W0 | ⬜ pending |
| 15-08-02 | 08 | 5 | GENOMICS-05 | T-15-05 / T-15-10 | FinnGenGwasRunObserverTest: 6 scenarios (step-2 success, case_n/control_n, top_hit_p_value, swallow, idempotency, step-1 failure) | unit (Pest) | `docker compose exec -T php vendor/bin/pest tests/Unit/FinnGen/FinnGenGwasRunObserverTest.php --parallel` | ❌ W0 | ⬜ pending |
| 15-08-03 | 08 | 5 | GENOMICS-03, GENOMICS-05, GENOMICS-14 | T-15-17 / T-15-21 | 3 Vitest component + 2 hook tests green | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/finngen-endpoint-browser/__tests__/"` | ❌ W0 | ⬜ pending |
| 15-09-01 | 09 | 6 | GENOMICS-03 (SC-4) | T-15-28 / T-15-31 | `finngen:gwas-smoke-test --via-http` extension mints Sanctum token, POSTs to live route, polls tracking row, verifies summary_stats count > 0 | integration | `docker compose exec -T php php artisan finngen:gwas-smoke-test --help \| grep via-http` | ✅ shipped | ✅ green (commit 4d4496508) |
| 15-09-02 | 09 | 6 | GENOMICS-03 (SC-4) | — | Real E2E on PANCREAS cohort 221 completes succeeded within 30 min; summary_stats count > 0; evidence in 15-GATE-EVIDENCE.md | E2E smoke (manual-gated) | `docker compose exec -T php php artisan finngen:gwas-smoke-test --via-http --endpoint=E4_DM2 --source=PANCREAS --control-cohort=221 --timeout-minutes=30 --user-email=admin@acumenus.net` | ⏸ deferred | ⏸ deferred — UAT debt; see [15-HUMAN-UAT.md](./15-HUMAN-UAT.md) for command + 7-item evidence checklist |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Several rows reference "W0" for File Exists — in Phase 15 "Wave 0" means Plan 01 creates the foundation (migration/model/exceptions/tests); "W1-W6" use the wave numbering from plan frontmatter. "❌ W0" means the file/check is established by Plan 01 or later, not yet existing at planning time.*

---

## Wave 0 Requirements (ship inside Plan 01)

- [x] `backend/database/migrations/2026_04_21_000100_create_finngen_endpoint_gwas_runs_and_runs_index.php` — Plan 01 Task 1
- [x] Partial expression index on `finngen.runs` (combined migration) — Plan 01 Task 1
- [x] `backend/app/Models/App/FinnGen/EndpointGwasRun.php` — Plan 01 Task 2
- [x] 8 typed exception classes — Plan 01 Task 3

*Test scaffolds are NOT Wave 0 in Phase 15 — Plan 08 writes the real tests directly (no RED-GREEN cycle needed because the specs are deterministic; Pest tests exercise real code once Plans 01-07 land).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E visual verification of drawer sections | GENOMICS-05, GENOMICS-14 | UI rendering needs human eye on clinical theme | Open `http://localhost:5175/workbench/finngen-endpoints` → click E4_DM2 → verify "Generation history" groups by source, "GWAS runs" lists rows, "Run GWAS" panel renders with source/control/covariate pickers. Capture screenshot in 15-GATE-EVIDENCE.md. (Plan 09 checkpoint.) |
| Rate-limit behavior under burst | D-30 (throttle:10,1) | Real request-timing hard to unit-test | `for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"source_key":"PANCREAS","control_cohort_id":221}' http://localhost:8082/api/v1/finngen/endpoints/E4_DM2/gwas; done` → expect 202/409 for first 10, then 429. Evidence: `15-GATE-EVIDENCE.md`. (Plan 09 checkpoint.) |
| Deep-link to Phase 16 PheWeb-lite | D-22 | Page doesn't exist yet — verify `<Link>` target only | Click a GWAS run row → verify URL is `/workbench/finngen-endpoints/{name}/gwas/{run_id}` → expect stub "Phase 16 coming soon" page (Plan 07 Task 2). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Per-Task Verification Map populated by planner)
- [x] Sampling continuity: every plan has at least one automated check; no 3 consecutive tasks without automated verify
- [x] Wave 0 (Plan 01) covers all MISSING references (migration + model + exceptions before any implementation task starts)
- [x] No watch-mode flags (all Pest/Vitest commands use one-shot reporters)
- [x] Feedback latency < 60 s for unit/feature tasks
- [x] E2E smoke command documented + PANCREAS cohort 221 fixture verified to exist pre-Wave 6 (checkpoint in Plan 09 Task 2)
- [ ] `nyquist_compliant: true` — set by Plan 09 Task 2 output summary after the E2E smoke lands green

**Approval:** planner-populated 2026-04-18; pending executor runs + Plan 09 checkpoint sign-off.
