# FinnGen SP2 — Code Explorer Design Spec

**Date:** 2026-04-15
**Sub-project:** SP2 of 4 (ROMOPAPI Code Explorer)
**Depends on:** SP1 Runtime Foundation (merged + deployed — commit `0c4489420`)
**Handoff source:** `2026-04-12-finngen-workbench-subprojects-handoff.md` §1
**Status:** Approved, ready for implementation planning
**Scope:** First user-visible FinnGen feature. Thin vertical slice validating the SP1 stack end-to-end.

---

## 1. Scope & Goals

### 1.1 Goal

Deliver an authenticated "Code Explorer" page at `/finngen/explore` where researchers pick a CDM source + OMOP concept and see four tabbed views (Counts, Relationships, Hierarchy, Report) plus a persistent "My Reports" history. Ships the first real consumer of SP1's foundation and proves the stack works end-to-end.

### 1.2 In scope

1. **Backend (Laravel)** — `CodeExplorerController` with 6 endpoints (4 GETs + 2 POSTs); new artisan `finngen:setup-source {source_key}` command wrapping a new `romopapi.setup` async run; seeder updates for 2 new `finngen_analysis_modules` rows (`romopapi.report`, `romopapi.setup`) and 2 new permissions (`finngen.code-explorer.view`, `finngen.code-explorer.setup`).
2. **Darkstar (R)** — `darkstar/api/finngen/romopapi_async.R` with `finngen_romopapi_report_execute()` and `finngen_romopapi_setup_source_execute()`; 2 new Plumber `@post` routes (`/finngen/romopapi/report`, `/finngen/romopapi/setup`); 2 testthat specs. Existing `finngen_romopapi_*` sync functions reused unchanged.
3. **Frontend shared** — Promote `features/text-to-sql/components/ConceptSearchInput.tsx` → `frontend/src/components/concept/ConceptSearchInput.tsx`. Update the single existing text-to-sql import.
4. **Frontend feature** — `features/code-explorer/` with page, 5 tab components (`CountsTab`, `RelationshipsTab`, `HierarchyTab`, `ReportTab`, `MyReportsTab`), TanStack hooks, ReactFlow-based `AncestorGraph`, Recharts-based `StratifiedCountsChart`, iframe-sandboxed report preview, `react-joyride` onboarding tour.
5. **Source initialization UX** — Source picker surfaces "Initialize source" CTA when `source-readiness` returns `ready=false`; kicks off `romopapi.setup` async run via `finngen.code-explorer.setup` permission (admin+super-admin only).
6. **Tests** — ~15 Pest (3 unit + 8 feature + 4 RBAC), 2 testthat (nightly slow-lane), ~10 Vitest (hooks + components + page smoke), 1 Playwright spec (nightly slow-lane).
7. **Caching** — Tiered Redis TTLs: counts 1h, relationships 24h, ancestors 24h. Cache key retains `{source_key}` segment for consistency.
8. **Docs** — SP2 devlog; runbook entry for `finngen:setup-source`.

### 1.3 Out of scope

- Mermaid rendering (dropped — ReactFlow consumes the structured `nodes + edges` payload directly per Q3)
- Interactive Plotly in reports (Q4 option C — deferred; SP2 ships static HTML + download)
- Concept search UI beyond the existing `ConceptSearchInput` (advanced faceting, source-scoped presence badges — SP3)
- Source-scoped concept filtering (Q5: global vocab search; use stratified counts to see presence)
- `finngen:invalidate-vocab` / `finngen:invalidate-source` cache management commands (Q6 option C — deferred)
- Path-scoped 90% coverage gate (separate ops ticket)

### 1.4 Non-goals

- No changes to SP1 `FinnGenRunService`, `FinnGenArtifactService`, `FinnGenErrorMapper`, or Nginx streaming config
- No new JS bundling pipeline in Darkstar (rules out Q4 option C)
- No pre-materialized per-source concept sets (rules out Q5 option B)
- No DB schema migrations — purely additive via seeders

---

## 2. Component Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + TypeScript + TanStack Query)                    │
│                                                                      │
│  Route: /finngen/explore                                             │
│  Feature: features/code-explorer/                                    │
│                                                                      │
│    pages/CodeExplorerPage.tsx                                        │
│      ├─ Left pane: SourcePicker + ConceptSearchInput (shared)        │
│      ├─ SourceReadinessBanner  (Initialize CTA when ready=false)     │
│      └─ Tabbed right pane:                                           │
│           CountsTab          → StratifiedCountsChart (Recharts)      │
│           RelationshipsTab   → DataTable (Parthenon primitive)       │
│           HierarchyTab       → AncestorGraph (ReactFlow)             │
│           ReportTab          → ReportButton + iframe preview         │
│           MyReportsTab       → DataTable filtered to romopapi.report │
│                                                                      │
│    api.ts (TanStack wrappers; all route through SP1 foundation)      │
│    types.ts                                                          │
│    hooks/                                                            │
│      useCodeCounts, useRelationships, useAncestors                   │
│      useSourceReadiness, useCreateReport                             │
│      useInitializeSource, useMyReports                               │
│                                                                      │
│  Shared (promoted from features/text-to-sql/):                       │
│    components/concept/ConceptSearchInput.tsx                         │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Laravel (additive to SP1)                                           │
│                                                                      │
│  Http/Controllers/Api/V1/FinnGen/                                    │
│    CodeExplorerController (NEW)                                      │
│      index              — not implemented (use tabs, not index)      │
│      counts             — proxies SyncRead with TTL=3600             │
│      relationships      — proxies SyncRead with TTL=86400            │
│      ancestors          — proxies SyncRead with TTL=86400            │
│      sourceReadiness    — DB probe; not cached                       │
│      createReport       — delegates to FinnGenRunService::create     │
│      initializeSource   — delegates to FinnGenRunService::create     │
│                                                                      │
│    SyncReadController (EXISTING, SP1) — still handles the generic    │
│    /finngen/sync/* routes; CodeExplorer is a semantic facade         │
│                                                                      │
│    RunController / ArtifactController (EXISTING, SP1) — consumed by  │
│    My Reports tab + report artifact download via signed URLs         │
│                                                                      │
│  Console/Commands/FinnGen/                                           │
│    SetupSourceCommand (NEW)                                          │
│      php artisan finngen:setup-source {source_key}                   │
│      → FinnGenRunService::create() with analysis_type='romopapi.setup'│
│      → waits on run to terminate (polls) + prints progress           │
│                                                                      │
│  database/seeders/                                                   │
│    FinnGenAnalysisModuleSeeder (MODIFIED — +2 rows)                  │
│    RolePermissionSeeder (MODIFIED — +2 permissions)                  │
└─────────────────┬────────────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Darkstar (R) — additive to SP1                                      │
│                                                                      │
│  api/finngen/romopapi_async.R (NEW)                                  │
│    finngen_romopapi_report_execute(source, run_id, export_folder,    │
│                                     params={concept_id})             │
│      1. build_cohort_table_handler(source) [RW role]                 │
│      2. write_progress(path, step="createReport", pct=10)            │
│      3. html_path <- ROMOPAPI::createReport(handler, concept_id)     │
│      4. copy html_path → export_folder/report.html                   │
│      5. write_progress done + summary.json                           │
│                                                                      │
│    finngen_romopapi_setup_source_execute(source, run_id,             │
│                                           export_folder, params={})  │
│      1. build_cohort_table_handler(source) [RW role]                 │
│      2. write_progress(path, step="create_tables", pct=10)           │
│      3. ROMOPAPI::createCodeCountsTables(handler)                    │
│      4. write_progress done + summary.json with table row count      │
│                                                                      │
│  api/finngen/routes.R (MODIFIED — +2 @post routes)                   │
│    @post /finngen/romopapi/report   → report_execute via mirai       │
│    @post /finngen/romopapi/setup    → setup_source_execute via mirai │
│                                                                      │
│  tests/testthat/                                                     │
│    test-finngen-romopapi-report.R (NEW — nightly slow lane)          │
│    test-finngen-romopapi-setup.R (NEW — nightly slow lane)           │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 New files

- **1 PHP controller** (`CodeExplorerController.php`, ~180 lines)
- **1 artisan command** (`SetupSourceCommand.php`, ~50 lines)
- **1 R file** (`romopapi_async.R`, ~120 lines)
- **2 testthat spec files**
- **~12 React/TS files** under `features/code-explorer/` (page + 5 tab components + hooks + api.ts + types.ts + barrel index.ts)
- **1 Vitest directory** (`features/code-explorer/__tests__/`)
- **1 Playwright spec** (`e2e/tests/finngen-code-explorer.spec.ts`)

### 2.2 Modified files

- `backend/database/seeders/FinnGenAnalysisModuleSeeder.php` — add 2 rows
- `backend/database/seeders/RolePermissionSeeder.php` — add 2 permissions + role assignments
- `darkstar/api/finngen/routes.R` — mount 2 new async routes
- `backend/routes/api.php` — add 6 new `/finngen/code-explorer/*` routes
- `frontend/src/features/text-to-sql/components/` — delete `ConceptSearchInput.tsx` (moved) + update 1 import site
- `frontend/src/app/router.tsx` — register `/finngen/explore`; nav entry under Research

### 2.3 Explicit non-architecture

The `CodeExplorerController` exposes stable `/finngen/code-explorer/*` URLs even though it delegates to `SyncReadController`'s logic. This is a deliberate facade — the Code Explorer UI calls feature-named routes, not generic sync-read URLs, so future refactors (tag-based cache invalidation, alternative cache backends) don't ripple into the React code.

---

## 3. Data Flow

### 3.1 Sync read flow (counts / relationships / ancestors)

Same pattern for all three; differs only in the Darkstar endpoint + TTL.

```
React                      Laravel                    Darkstar              Postgres
  │                           │                          │                     │
  │ useCodeCounts("EUNOMIA",  │                          │                     │
  │   201826)                 │                          │                     │
  │ GET /code-explorer/counts │                          │                     │
  │   ?source=EUNOMIA         │                          │                     │
  │   &concept_id=201826      │                          │                     │
  ├──────────────────────────>│                          │                     │
  │                           │ auth + permission        │                     │
  │                           │   :finngen.code-         │                     │
  │                           │    explorer.view         │                     │
  │                           │                          │                     │
  │                           │ Cache::get(key)          │                     │
  │                           │ ──HIT──> return JSON     │                     │
  │                           │ ──MISS─> build source    │                     │
  │                           │   context (RO)           │                     │
  │                           │                          │                     │
  │                           │ GET /finngen/romopapi/   │                     │
  │                           │   code-counts            │                     │
  │                           ├─────────────────────────>│                     │
  │                           │                          │ build CDMdbHandler  │
  │                           │                          │ ROMOPAPI::          │
  │                           │                          │  getCodeCounts()    │
  │                           │                          ├────────────────────>│
  │                           │                          │<── tibble ──────────│
  │                           │<── JSON ─────────────────│                     │
  │                           │ Cache::put(TTL)          │                     │
  │<──200 JSON────────────────│                          │                     │
```

**TTLs:**
- `/code-explorer/counts` → 3600s (1h) — tracks `*_results.stratified_code_counts` freshness
- `/code-explorer/relationships` → 86400s (24h) — vocab-only, slow-changing
- `/code-explorer/ancestors` → 86400s (24h) — vocab-only

**Cache key format:** `finngen:sync:code-explorer:{endpoint}:{source_key}:{md5(query_hash)}`. Source key retained per Q6 for consistency with SP1's mental model ("everything scoped by source").

**Error enrichment:** When `/code-explorer/counts` receives a Darkstar `DARKSTAR_R_DB_SCHEMA_MISMATCH` response and the error message indicates `stratified_code_counts` is the missing table, the controller enriches the 422 response:

```json
{
  "error": {
    "code": "FINNGEN_SOURCE_NOT_INITIALIZED",
    "message": "Source 'EUNOMIA' needs one-time setup before code counts can be queried.",
    "action": {
      "type": "initialize_source",
      "source_key": "EUNOMIA"
    },
    "darkstar_error": {
      "category": "DB_SCHEMA_MISMATCH",
      "message": "relation \"eunomia_results.stratified_code_counts\" does not exist"
    }
  }
}
```

The React `CountsTab` reads `error.action.type === "initialize_source"` and renders the "Initialize source" CTA inline.

### 3.2 Source readiness probe

```
React                      Laravel                              Postgres
  │                           │                                    │
  │ useSourceReadiness(       │                                    │
  │   "EUNOMIA")              │                                    │
  │ GET /code-explorer/       │                                    │
  │   source-readiness        │                                    │
  │   ?source=EUNOMIA         │                                    │
  ├──────────────────────────>│                                    │
  │                           │ auth + permission                  │
  │                           │ SourceCtx::build(RO)               │
  │                           │                                    │
  │                           │ SELECT EXISTS(                     │
  │                           │   SELECT 1                         │
  │                           │   FROM information_schema.tables   │
  │                           │   WHERE table_schema =             │
  │                           │     source.schemas.results         │
  │                           │     AND table_name =               │
  │                           │     'stratified_code_counts'       │
  │                           │ )                                  │
  │                           ├───────────────────────────────────>│
  │                           │<── true/false ─────────────────────│
  │                           │                                    │
  │                           │ query active setup runs:           │
  │                           │ SELECT id FROM app.finngen_runs    │
  │                           │   WHERE source_key=EUNOMIA         │
  │                           │     AND analysis_type='romopapi.setup'
  │                           │     AND status IN ('queued',       │
  │                           │                     'running')     │
  │                           │   ORDER BY created_at DESC LIMIT 1 │
  │                           ├───────────────────────────────────>│
  │                           │<── run_id? ────────────────────────│
  │<── {                      │                                    │
  │  source_key: "EUNOMIA",   │                                    │
  │  ready: false,            │                                    │
  │  missing:                 │                                    │
  │    ["stratified_code_counts"], │                               │
  │  setup_run_id: null       │                                    │
  │  OR run_id string         │                                    │
  │ } ────────────────────────│                                    │
```

**Response shape:**
```json
{
  "source_key": "EUNOMIA",
  "ready": false,
  "missing": ["stratified_code_counts"],
  "setup_run_id": null
}
```

When `setup_run_id` is populated (an active setup run exists), the UI shows "Setup in progress" with `useFinnGenRun(setup_run_id)` polling instead of the Initialize button. Readiness is NOT cached — cheap query, small payload, changes exactly once per source per lifetime.

### 3.3 Initialize source (async setup)

Full SP1 async run lifecycle, reused verbatim. New `romopapi.setup` analysis_type dispatches Darkstar endpoint `/finngen/romopapi/setup`; worker `finngen_romopapi_setup_source_execute()` calls `ROMOPAPI::createCodeCountsTables(handler)`.

```
React                      Laravel                    Horizon            Darkstar          Postgres
  │                           │                         │                   │                 │
  │ useInitializeSource       │                         │                   │                 │
  │   .mutate({source_key:    │                         │                   │                 │
  │            "EUNOMIA"})    │                         │                   │                 │
  │ POST /code-explorer/      │                         │                   │                 │
  │   initialize-source       │                         │                   │                 │
  │   {source_key}            │                         │                   │                 │
  │   Idempotency-Key: <uuid> │                         │                   │                 │
  ├──────────────────────────>│                         │                   │                 │
  │                           │ auth + permission:      │                   │                 │
  │                           │  finngen.code-          │                   │                 │
  │                           │  explorer.setup         │                   │                 │
  │                           │  (admin+super-admin)    │                   │                 │
  │                           │                         │                   │                 │
  │                           │ FinnGenRunService       │                   │                 │
  │                           │  ::create(user,         │                   │                 │
  │                           │   source_key,           │                   │                 │
  │                           │   'romopapi.setup', {}) │                   │                 │
  │                           │ → insert queued run     ├────────────────────────────────────>│
  │                           │ → dispatch Horizon job  ├────────────────>│                   │
  │<── 201 {run_id} ──────────│                         │                 │                   │
  │                           │                         │ worker picks up │                   │
  │ (poll useFinnGenRun       │                         │ markRunning     ├────────────────────>
  │  every 3s→10s)            │                         │ build src (RW)  │                   │
  │                           │                         │ POST /finngen/  │                   │
  │                           │                         │   romopapi/setup├──────────────────>│
  │                           │                         │                 │ mirai::mirai({    │
  │                           │                         │                 │  ROMOPAPI::       │
  │                           │                         │                 │  createCodeCounts │
  │                           │                         │                 │  Tables(handler)  │
  │                           │                         │                 │ })                │
  │                           │                         │<─{job_id}───────│                   │
  │                           │                         │ poll /jobs/     │                   │
  │                           │                         │  status/{id}    │                   │
  │                           │                         │ until done      │                   │
  │                           │                         │ markSucceeded   ├────────────────────>
```

Progress shape written by `write_progress()` (SP1 utility):
```json
{"step":"build_handler","pct":5}
{"step":"create_tables","pct":10,"message":"Building stratified_code_counts table..."}
{"step":"populate_tables","pct":50,"message":"Populating code counts from CDM..."}
{"step":"create_indices","pct":90}
{"step":"done","pct":100}
```

React auto-invalidates `useSourceReadiness` query on `status=succeeded` via TanStack Query's success callback chain.

**Concurrent setup guard:** Two admins clicking "Initialize" in parallel:
- Different Idempotency-Keys → 2 `finngen_runs` rows → 2 Horizon workers → 2 mirai tasks
- Both workers run `ROMOPAPI::createCodeCountsTables(handler)`, which (per ROMOPAPI source) uses `CREATE TABLE IF NOT EXISTS` under the hood — second worker is effectively a no-op
- Idempotency middleware doesn't dedupe across distinct users/keys, by design

### 3.4 Generate report (async)

Same pattern as 3.3 — new `romopapi.report` analysis_type. Worker calls `ROMOPAPI::createReport(handler, conceptId)`, copies generated HTML into `runs/{run_id}/report.html`.

**UI integration:**
1. User clicks "Generate report" on the Report tab
2. `useCreateReport` mutation → `POST /code-explorer/report {source_key, concept_id}` with `Idempotency-Key` header
3. Laravel creates run + dispatches job → `201 {run_id}`
4. UI shows progress via `useFinnGenRun(run_id)` polling
5. On `status=succeeded`:
   - Inline `<iframe sandbox="allow-same-origin">` pointing at the signed-URL artifact endpoint
   - "Download" button linking to same signed URL with `Content-Disposition: attachment`
6. Report persists in `app.finngen_runs` → user sees it in "My Reports" tab → clicks the row → reopens at the Report tab with that run_id loaded

**Retry after failure:** `useCreateReport` (which wraps SP1's `useCreateFinnGenRun`) holds a stable Idempotency-Key per component instance. If the first attempt ends in a terminal `failed` state and the user clicks "Generate report" again, the `ReportButton` first calls `resetIdempotencyKey()` to mint a fresh UUID, so the SP1 idempotency middleware treats the retry as a distinct request rather than replaying the cached failure response.

**My Reports tab:**
```
GET /api/v1/finngen/runs?analysis_type=romopapi.report
    → filters to current user's rows (RBAC enforced by SP1 RunPolicy)
    → paginated table with timestamp, source, concept_id, status, pin-toggle
    → click row → /finngen/explore?report_run_id={id}&tab=report
```

Pin/unpin via SP1's existing `/runs/{id}/pin` endpoints. 90-day GC auto-expires unpinned reports (spec §5.9 SP1).

---

## 4. API Contracts

### 4.1 Laravel REST — new routes

All under `/api/v1/finngen/code-explorer/*`, behind `auth:sanctum` + RBAC. All under `Route::prefix('finngen/code-explorer')->middleware(['auth:sanctum'])->group(...)` in `backend/routes/api.php`.

| Method | Path | Permission | Query/Body | Response | Middleware |
|---|---|---|---|---|---|
| GET | `/code-explorer/source-readiness` | `finngen.code-explorer.view` | `?source=X` | `{ source_key, ready, missing[], setup_run_id }` | `permission:finngen.code-explorer.view` |
| GET | `/code-explorer/counts` | `finngen.code-explorer.view` | `?source=X&concept_id=N` | Darkstar code-counts payload | `permission` + `throttle:60,1` |
| GET | `/code-explorer/relationships` | `finngen.code-explorer.view` | `?source=X&concept_id=N` | Darkstar relationships payload | `permission` + `throttle:60,1` |
| GET | `/code-explorer/ancestors` | `finngen.code-explorer.view` | `?source=X&concept_id=N&direction=both&max_depth=3` | `{ nodes[], edges[] }` — **`mermaid` field stripped at controller layer** (Darkstar still emits it for SP1 test compatibility; CodeExplorerController removes before returning) | `permission` + `throttle:60,1` |
| POST | `/code-explorer/report` | `finngen.code-explorer.view` | `{ source_key, concept_id }` + `Idempotency-Key` | `201 FinnGenRun` | `permission` + `finngen.idempotency` + `throttle:10,1` |
| POST | `/code-explorer/initialize-source` | `finngen.code-explorer.setup` (admin+) | `{ source_key }` + `Idempotency-Key` | `201 FinnGenRun` | `permission` + `finngen.idempotency` + `throttle:10,1` |

### 4.2 Darkstar HTTP — new endpoints

Two new `@post` routes in `darkstar/api/finngen/routes.R`:

| Method | Path | Body | Returns | Worker function | Role |
|---|---|---|---|---|---|
| POST | `/finngen/romopapi/report` | `{source, run_id, params: {concept_id}}` | `{job_id, status: "running"}` | `finngen_romopapi_report_execute()` | RW |
| POST | `/finngen/romopapi/setup` | `{source, run_id, params: {}}` | `{job_id, status: "running"}` | `finngen_romopapi_setup_source_execute()` | RW |

Both use the SP1 source envelope shape (§4.2.1), build `CohortTableHandler`, wrap the ROMOPAPI call in `run_with_classification()` for pre-classified error categories, write progress/summary/result.json to the shared volume.

### 4.3 Module registry rows (seeder-added)

```
key                  label                       description                                                     darkstar_endpoint              min_role
romopapi.report      ROMOPAPI Report             HTML report with concept metadata, counts, and hierarchy.       /finngen/romopapi/report       researcher
romopapi.setup       ROMOPAPI Source Setup       Materializes stratified_code_counts table for a CDM source.     /finngen/romopapi/setup        admin
```

SP1's `FinnGenAnalysisModuleRegistry::assertEnabled($key)` handles lookup; `FinnGenRunService::create()` validates params and dispatches. No changes to SP1 services.

### 4.4 Permissions (seeder-added)

Two new Spatie permissions in `app.permissions`:
- `finngen.code-explorer.view` — seeded to `researcher`, `admin`, `super-admin` roles
- `finngen.code-explorer.setup` — seeded to `admin`, `super-admin` only

Seeded via extending `RolePermissionSeeder::run()`'s existing permission matrix.

### 4.5 Frontend API hooks

All wrap SP1's `finngenApi` from `features/_finngen-foundation/` — no new axios client, no new interceptors:

```ts
// features/code-explorer/api.ts
useCodeCounts(sourceKey, conceptId)                       // useQuery, staleTime 30s
useRelationships(sourceKey, conceptId)                    // useQuery, staleTime 5min
useAncestors(sourceKey, conceptId, direction, maxDepth)   // useQuery, staleTime 5min
useSourceReadiness(sourceKey)                             // useQuery, staleTime 15s
useCreateReport()                                         // useMutation via useCreateFinnGenRun
useInitializeSource()                                     // useMutation via useCreateFinnGenRun
useMyReports()                                            // useQuery filtering listRuns by analysis_type
```

Client-side `staleTime` independent of server Redis TTL — client caches govern re-render frequency, server caches govern Darkstar hit frequency.

**Cross-hook invalidation:** `useInitializeSource` attaches an `onSuccess` callback that polls `useFinnGenRun(setupRunId)` until terminal; when `status=succeeded`, it calls `queryClient.invalidateQueries({ queryKey: ['finngen','code-explorer','source-readiness'] })` so the next render refetches readiness and the banner flips to ready. `useCreateReport` similarly invalidates `['finngen','code-explorer','my-reports']` on dispatch success so the My Reports tab shows the new run immediately.

### 4.6 OpenAPI types

`./deploy.sh --openapi` regenerates `frontend/src/types/api.generated.ts` (gitignored). Picks up the 6 new Laravel routes automatically via the Scribe → openapi-typescript pipeline.

---

## 5. Error Handling

All error paths inherit from SP1's taxonomy (§5.1):
- `FINNGEN_*` for Laravel validation / policy
- `FINNGEN_DARKSTAR_*` for transport
- `DARKSTAR_R_*` for R-side pre-classified errors

### 5.1 New error code

SP2 introduces exactly one new code:

| Code | HTTP | Trigger | Response shape |
|---|---|---|---|
| `FINNGEN_SOURCE_NOT_INITIALIZED` | 422 | `/code-explorer/counts` hits `DARKSTAR_R_DB_SCHEMA_MISMATCH` on the specific `stratified_code_counts` table | Standard ApiError + `action: {type, source_key}` field |

Emitted by `CodeExplorerController::counts` when pattern-matching the inner Darkstar error. All other error paths are unchanged from SP1.

### 5.2 Retry semantics

- Sync read 4xx from Darkstar → pass through to React (no retry, fail fast — user interaction pattern)
- Async run failures → inherit SP1's retry policy (3 tries with backoff on transport; no retry on R-classified errors)
- Setup-source failure → marked `failed` with the classified R error; user can retry via the Initialize button (new Idempotency-Key, new run row)
- Report generation failure → same — marked `failed`, visible in "My Reports" with the error; user can re-click "Generate report"

### 5.3 Progress writing

Both new workers use SP1's `write_progress()` rotating-buffer utility (§5.10). 500-line cap, atomic temp-file-then-rename. Progress polling from React uses `useFinnGenRun` which refreshes every 3s during the fast phase (first 30s) then 10s after.

---

## 6. Testing

### 6.1 Backend — Pest (target: ~15 tests)

**`tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php`** (3 tests)
- Cache key format canonical
- Deterministic hashing for identical params
- Per-endpoint TTL constants match spec

**`tests/Feature/FinnGen/CodeExplorerEndpointsTest.php`** (8 tests)
- GET `/code-explorer/counts` happy path (Http::fake Darkstar)
- GET `/code-explorer/counts` with DB_SCHEMA_MISMATCH → 422 with `action.type: initialize_source`
- GET `/code-explorer/relationships` happy path + cache hit on second call
- GET `/code-explorer/ancestors` happy path with `max_depth` clamped to 7
- GET `/code-explorer/source-readiness` ready=true path
- GET `/code-explorer/source-readiness` ready=false with active setup_run_id populated
- POST `/code-explorer/report` dispatches `romopapi.report` run (`Bus::fake`)
- POST `/code-explorer/initialize-source` dispatches `romopapi.setup` run

**`tests/Feature/FinnGen/CodeExplorerRBACTest.php`** (4 tests)
- Unauthenticated → 401 across all endpoints
- Viewer lacks `finngen.code-explorer.view` → 403 on all routes
- Researcher passes on view+report, fails 403 on `initialize-source`
- Admin passes on all endpoints including setup

### 6.2 Darkstar — testthat (target: 2 tests, nightly slow-lane)

**`darkstar/tests/testthat/test-finngen-romopapi-report.R`** — happy path against Eunomia vocab:
- Build handler, call `finngen_romopapi_report_execute()` for concept 201826
- Assert `runs/{id}/report.html` exists and is non-empty
- Assert `summary.json` has expected shape

**`darkstar/tests/testthat/test-finngen-romopapi-setup.R`** — destructive test against `eunomia_results`:
- Call `finngen_romopapi_setup_source_execute()`
- Assert `stratified_code_counts` table exists in `eunomia_results`
- Assert row count > 0
- Cleanup in `on.exit` via `DROP TABLE IF EXISTS`

Both gated in CI's `darkstar-integration` job (nightly + push to main).

### 6.3 Frontend — Vitest (target: ~10 tests)

Under `frontend/src/features/code-explorer/__tests__/`:

**Hooks:**
- `useSourceReadiness.test.tsx` — 15s staleTime; auto-invalidates on `setup_run_id` transitioning to succeeded
- `useCodeCounts.test.tsx` — happy path + error with `action.type` surfaced
- `useCreateReport.test.tsx` — mutation success returns `run_id`

**Components:**
- `StratifiedCountsChart.test.tsx` — renders legend + bars; node/descendant toggle switches data source
- `AncestorGraph.test.tsx` — ReactFlow renders N nodes + M edges; click fires `onConceptSelect(conceptId)`
- `ReportButton.test.tsx` — disabled without source+concept; click dispatches mutation; progress bar appears while running
- `SourceReadinessBanner.test.tsx` — shows Initialize CTA when `ready=false` + no setup_run_id; shows progress when setup_run_id present
- `MyReportsTab.test.tsx` — renders table; row click fires navigation

**Page:**
- `CodeExplorerPage.test.tsx` — mounts page; tabs switch; source picker updates URL params

### 6.4 Playwright — E2E (1 spec, nightly slow-lane)

`e2e/tests/finngen-code-explorer.spec.ts`:
- Login + navigate to `/finngen/explore`
- Source picker shows EUNOMIA
- Pick concept → Counts tab shows ≥1 chart row
- Switch to Relationships → table populated
- Switch to Hierarchy → ≥1 ReactFlow node visible
- Click "Generate report" → API returns 201; poll status via API until terminal within 60s; assert report.html signed URL works

Gated behind env readiness (skip on 422/502/503/504) as per SP1's E2E pattern.

### 6.5 Coverage

80% gate inherited from SP1's `finngen-tests.yml` CI workflow. No path-scoped 90% enforcement for CodeExplorerController — separate ops ticket (deferred).

### 6.6 What we do NOT test

- ConceptSearchInput internals — covered by the text-to-sql suite which runs unchanged after the promotion
- Atlas WebAPI integration — SP4
- Setup-source on SynPUF-scale data — characterization is post-SP2 ops work

---

## 7. Rollout & Migration

### 7.1 Pre-merge checklist (Definition of Done)

- [ ] Pest FinnGen suite green (SP1 100 + SP2 ~15 = ~115 total)
- [ ] Vitest `features/code-explorer/` green (~10 tests)
- [ ] Vitest `features/text-to-sql/` still green after ConceptSearchInput promotion
- [ ] Vitest `features/_finngen-foundation/` still 13/13
- [ ] tsc clean, vite build clean, eslint clean on new directories
- [ ] Pint + PHPStan L8 clean on new PHP files
- [ ] Playwright spec written (not required to run in fast lane)
- [ ] `./deploy.sh --openapi` regenerates `api.generated.ts` with 6 new `/code-explorer/*` paths
- [ ] `artisan route:list --path=code-explorer` → 6 routes with correct middleware
- [ ] `finngen:snapshot-openapi` picks up the 6 new routes
- [ ] Darkstar `/health.finngen.packages_loaded` unchanged (no new R packages)
- [ ] Devlog at `docs/devlog/modules/finngen/sp2-code-explorer.md` written
- [ ] Runbook entry added for `finngen:setup-source`

### 7.2 Migration order (deploy)

No DB migrations. Seeder updates + one artisan command only.

```bash
# 1. Standard deploy — picks up code changes
./deploy.sh

# 2. Re-run seeders to add 2 analysis_modules rows + 2 permissions
docker compose exec php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder'
docker compose exec php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\RolePermissionSeeder'

# 3. Clear route + config cache (deploy.sh already does this, explicit for clarity)
docker compose exec php sh -c 'cd /var/www/html && \
  php artisan route:clear && php artisan cache:clear'

# 4. Post-deploy verification
curl -s https://parthenon.acumenus.net/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: { source_key: "EUNOMIA", ready: false, missing: [...], setup_run_id: null }

# 5. One-time source setup as admin
docker compose exec php sh -c 'cd /var/www/html && \
  php artisan finngen:setup-source EUNOMIA'
# Blocks; prints progress; ~30s-5min on Eunomia, longer on SynPUF

# 6. Verify readiness flipped
curl -s https://parthenon.acumenus.net/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA | jq '.ready'
# Expected: true
```

Per MEMORY `feedback_deploy_migration_guard`: full `./deploy.sh` skips migrations by default — safe. Seeder calls in step 2 are idempotent (Parthenon seeders use `updateOrCreate`/`findOrCreate`).

### 7.3 Rollback plan

`git revert <sp2-merge-sha> && ./deploy.sh`. Clean because SP2 is purely additive:

- **No DB schema changes** — nothing to unroll
- **2 module-registry rows** (`romopapi.report`, `romopapi.setup`) — stay in `app.finngen_analysis_modules` on revert, unused. Optional cleanup: `DELETE FROM app.finngen_analysis_modules WHERE key IN ('romopapi.report','romopapi.setup')`
- **2 permission rows** — same deal, harmless to leave
- **`stratified_code_counts` tables** on each source — **leave in place even on revert**. Expensive to rebuild, doesn't interfere. Manual drop if desired: `DROP TABLE {results_schema}.stratified_code_counts`
- **Route cache** — `route:clear` after revert
- **Report artifacts** — stay on disk until 90-day GC naturally prunes

### 7.4 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `CreateCodeCountsTables` runtime on large CDMs | medium | setup takes hours; blocks first user on SynPUF | Admin-gated via permission; runs as background job; live progress via `/runs/{id}`; runbook documents expected duration per CDM |
| ReactFlow bundle size | low | +130KB gzip on `/finngen/explore` chunk | Code-split the route via Vite dynamic import; ReactFlow only loads when user navigates there |
| ConceptSearchInput promotion breaks text-to-sql | low | text-to-sql picker 404s | Move + update import atomically in one commit; Vitest on text-to-sql is a pre-merge gate |
| Report generation first-use failure in prod | medium | user confusion; classified error with no happy-path precedent | Nightly testthat against Eunomia; post-deploy manual report generation for concept 201826 (diabetes) as smoke check |
| Concurrent setup attempts | low | two parallel mirai tasks on same source | `CREATE TABLE IF NOT EXISTS` in ROMOPAPI — second worker is no-op; idempotency keys dedupe per-user retries |
| Client-side polling on long-running setup | low | `useFinnGenRun` polls every 3s for a 2h setup (~2400 HTTP calls) | Acceptable — SP1 rate limit is 120/min on `/runs/{id}`; TanStack Query pauses `refetchInterval` on unmount |

### 7.5 Success criteria (7-day post-deploy)

1. Zero regressions on SP1 endpoints or tests
2. ≥1 successful `romopapi.report` run in production via the UI
3. `finngen:setup-source EUNOMIA` completed successfully; table exists in `eunomia_results`
4. `/finngen/explore` page loads ≤2s (Lighthouse / Web Vitals)
5. Sync read cache hit rate ≥80% on relationships/ancestors (Redis MONITOR sample)
6. Zero 5xx on `/code-explorer/*` routes (Laravel logs)
7. Playwright E2E spec passes in the nightly slow lane at least once

### 7.6 Post-SP2 follow-ups

- Path-scoped 90% coverage gate for `CodeExplorerController.php` — separate ops ticket
- Source-initialized badge in the Sources admin page — SP3 adjacent
- Concept presence badges in ConceptSearchInput (Q5 option C) — if users request
- Interactive Plotly in reports (Q4 option C) — hardening task
- `finngen:invalidate-vocab` / `finngen:invalidate-source` cache management — if operational pain emerges

### 7.7 Communication

- **Internal:** commit SP2 devlog at merge; link runbook for ops
- **External:** first user-visible FinnGen feature. Worth a Parthenon release-notes mention. Draft: *"Code Explorer is now available under Research → Code Explorer. Look up any OMOP concept to see its distribution, relationships, hierarchy, and generate a downloadable report for any CDM source."*
- **Changelog:** per global rule, update "What's New" only on GitHub release.

---

## Appendix A — Cross-references

- **SP1 spec:** `docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md`
- **SP1 plan:** `docs/superpowers/plans/2026-04-12-finngen-runtime-foundation.md`
- **Subprojects handoff (original SP2 outline):** `docs/superpowers/specs/2026-04-12-finngen-workbench-subprojects-handoff.md` §1
- **SP1 devlog:** `docs/devlog/modules/finngen/sp1-runtime-foundation.md`
- **SP1 runbook:** `docs/devlog/modules/finngen/runbook.md`
- **HIGHSEC rules:** `.claude/rules/HIGHSEC.spec.md`

## Appendix B — Decisions log (from brainstorm)

| # | Topic | Decision | Rationale |
|---|---|---|---|
| 1 | Concept picker | **B**: Promote ConceptSearchInput to shared `components/concept/` | SP3/SP4 will consume it too; amortizes the move cost |
| 2 | ROMOPAPI setup | **C**: Artisan command + UI "Initialize" button gated on admin permission | Best UX + clean RO/RW role separation + self-service when admins are available |
| 3 | Ancestor viz | **C**: ReactFlow from `nodes+edges`, drop Mermaid | Interactive clicks enable "explore concept" loop; similar bundle cost |
| 4 | Report CSP | **A**: Strict CSP + inline iframe preview + download button | Ships now; no bundling pipeline; download restores full interactivity |
| 5 | Concept search | **A**: Global vocab search via existing ConceptSearchInput | Fewer infrastructure assumptions; counts already signal presence |
| 6 | Caching | **B + keep source in key**: Tiered TTLs (24h/24h/1h) | Matches data-change cadence; modest cache-hit loss on relationships/ancestors |
| 7 | Report lifecycle | **B + pin**: Persistent runs + "My Reports" tab | Validates SP1's run-listing surface; minimal UI cost |
