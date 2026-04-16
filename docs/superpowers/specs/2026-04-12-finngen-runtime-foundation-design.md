# FinnGen Runtime Foundation — Design Spec

**Date:** 2026-04-12
**Sub-project:** SP1 of 4 (Runtime Foundation)
**Sibling spec:** `2026-04-12-finngen-workbench-subprojects-handoff.md` (deferred sub-projects 2–4)
**Status:** Approved, ready for implementation planning
**Scope:** Make Darkstar the host runtime for three FinnGen R packages and define the Laravel ↔ Darkstar handshake. No user-visible UI lands in SP1.

---

## 1. Scope & Goals

### 1.1 Goal

Make Darkstar (`parthenon-darkstar`, service `darkstar`, port 8787) the host runtime for three FinnGen R packages (ROMOPAPI, HadesExtras, CO2AnalysisModules) and define the Laravel ↔ Darkstar handshake for both fast sync reads and long async analyses. Deliver the plumbing that all three downstream sub-projects (Code Explorer, Analysis Module Gallery, Cohort Workbench) depend on.

**SP1 does not ship any user-visible UI.**

### 1.2 In scope

1. Install ROMOPAPI, HadesExtras, CO2AnalysisModules into Darkstar's site-library via extension to `darkstar/install_deps.R`; never load the Shiny UI modules from these packages.
2. New Plumber route files in `darkstar/api/finngen/` for:
   - Sync endpoints (ROMOPAPI code counts/relationships/ancestors; HadesExtras demographics/overlap/counts)
   - Async analysis endpoints (`execute_*` from CO2AnalysisModules; `generateCohortSet` + matching via HadesExtras; ROMOPAPI report generation)
3. New `finngen_runs` Eloquent table + model + `FinnGenRunService` replacing the current `backend/app/Services/StudyAgent/FinnGen*.php` layer.
4. New `finngen_analysis_modules` module registry table (stub schema in SP1; filled out by SP3).
5. Horizon job (`RunFinnGenAnalysisJob`) that dispatches async work to Darkstar and polls Darkstar's `/jobs/{id}` API until completion.
6. Shared artifact volume (`finngen-artifacts`) mounted into both `darkstar` and `php` containers; Laravel serves artifacts via signed-URL controller with RBAC.
7. Idempotency middleware on `POST /finngen/runs` (shared-secret Redis SETNX, 5-minute TTL).
8. Two new Postgres roles: `parthenon_finngen_ro` (reads) and `parthenon_finngen_rw` (writes to `*_results` / cohort tables).
9. Periodic orphan reconciler (`php artisan finngen:reconcile-orphans`, 15-min schedule) + boot-time reconciler.
10. Nightly 90-day GC command (`php artisan finngen:prune-runs`) with user-level `pinned` override.
11. Weekly artifact sweeper (`php artisan finngen:sweep-artifacts`) for disk/DB consistency.
12. Deletions: `docker/finngen-runner/`, `external/finngen/finngen-runner/`, compose entries for `finngen-runner`, all `backend/app/Services/StudyAgent/FinnGen*.php`, `backend/app/Models/App/FinnGenRun.php`, `frontend/src/features/workbench/toolsets.ts`, `frontend/src/features/investigation/components/phenotype/{CohortOperationPanel,CodeWASRunner}.tsx`. Route cleanup in `backend/routes/api.php`.

### 1.3 Out of scope (handed off to SP2–4)

- ROMOPAPI React Code Explorer → SP2
- Analysis Module React gallery + DuckDB-wasm result viewers → SP3
- Cohort Workbench (drag-and-drop operations, matching, Atlas import) → SP4
- Any React work beyond the hooks + types consumed by SP2/3/4

### 1.4 Non-goals

- No Shiny runtime, no iframe of upstream CO2, no separate `finngen-runner` container.
- No new auth scheme — inherit `parthenon_backend` network isolation used by existing `HadesBridgeService`.
- No multi-host deployment (Darkstar and PHP remain co-located; volume sharing is acceptable).
- No GWAS implementation (flag-gated, requires Regenie infrastructure).

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                          │
│                                                                      │
│   frontend/src/features/<sp2|sp3|sp4>/*  (built in later SPs)        │
│        │                                                             │
│        │  TanStack Query hooks → axios → /api/v1/finngen/*           │
└────────┼─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      parthenon-php (Laravel 11)                      │
│                                                                      │
│   Http/Controllers/Api/V1/FinnGen/                                   │
│     RunController           (list/show/cancel/pin/dispatch)          │
│     ArtifactController      (signed-URL streaming)                   │
│     SyncReadController      (proxy for Darkstar sync endpoints)      │
│     AnalysisModuleController (registry read)                         │
│                                                                      │
│   Http/Middleware/                                                   │
│     EnforceFinnGenIdempotency                                        │
│                                                                      │
│   Services/FinnGen/                                                  │
│     FinnGenClient            HTTP client → http://darkstar:8787      │
│     FinnGenRunService        creates finngen_runs, dispatches job    │
│     FinnGenArtifactService   signs URLs, streams from shared volume  │
│     FinnGenSourceContextBuilder  source_key → connection payload     │
│     FinnGenErrorMapper       DARKSTAR_R_* → translation keys         │
│     FinnGenAnalysisModuleRegistry                                    │
│                                                                      │
│   Jobs/FinnGen/                                                      │
│     RunFinnGenAnalysisJob    dispatches to Darkstar, polls jobs API  │
│                                                                      │
│   Models/App/FinnGen/                                                │
│     Run                      (finngen_runs table)                    │
│     AnalysisModule           (finngen_analysis_modules table)        │
│                                                                      │
│   Console/Commands/                                                  │
│     FinnGenPruneRunsCommand      (nightly, 90-day GC)                │
│     FinnGenSweepArtifactsCommand (weekly, file/DB reconciliation)    │
│     FinnGenReconcileOrphansCommand (every 15 min + boot)             │
│     FinnGenSmokeTestCommand      (post-deploy verification)          │
│     FinnGenSnapshotOpenapiCommand (CI contract-drift guard)          │
└──────┬──────────────────────────────────┬───────────────────────────┘
       │                                  │
       │  Horizon queue (redis)           │  Eloquent
       │                                  │
       ▼                                  ▼
┌────────────────────┐         ┌──────────────────────────────────────┐
│  parthenon-horizon │         │  parthenon-postgres                  │
│                    │         │    app.finngen_runs                  │
│  RunFinnGenAnalysis│         │    app.finngen_analysis_modules      │
│    Job worker      │         │    (+ 2 new PG roles)                │
└──────┬─────────────┘         └──────────────────────────────────────┘
       │ HTTP → Darkstar
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   parthenon-darkstar (darkstar:8787)                 │
│                                                                      │
│   plumber_api.R  (existing, extended with finngen route mounts)      │
│   valve_launcher.R  (existing — mirai::daemons(n=3L))                │
│                                                                      │
│   api/                                                               │
│     jobs.R                  (existing — /jobs/{id} polling)          │
│     characterization.R      (existing, unchanged)                    │
│     ... (11 other existing files untouched)                          │
│     finngen/                (NEW in SP1)                             │
│       common.R              (run_with_classification, progress writer│
│                              source → CohortTableHandler builder)    │
│       romopapi.R            (sync endpoints, used by SP2)            │
│       hades_extras.R        (sync endpoints, used by SP3/SP4)        │
│       co2_analysis.R        (async endpoints, used by SP3)           │
│       cohort_ops.R          (async endpoints, used by SP4)           │
│                                                                      │
│   R site-library (extended by SP1's install_deps.R additions)        │
│     ROMOPAPI (new — import, never runApiServer())                    │
│     HadesExtras (new)                                                │
│     CO2AnalysisModules (new — execute_* only, never library())       │
│     HADES stack (existing)                                           │
└──────────┬──────────────────────────────────────────────────────────┘
           │ JDBC (DatabaseConnector)
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         parthenon-postgres                           │
│     vocab.*, omop.*, synpuf.*, ... (CDM schemas)                     │
│     *_results.*, *_results.cohort (per-source cohort tables)         │
└─────────────────────────────────────────────────────────────────────┘

Shared Docker volume: finngen-artifacts
  mounted at /opt/finngen-artifacts in both darkstar and php containers
  layout: runs/{run_id}/{results.duckdb|log.txt|report.html|progress.json|
                        params.json|result.json|summary.json}
```

### 2.1 Service inventory

| Container | Role in SP1 | Changes |
|---|---|---|
| `parthenon-php` | Laravel API + Horizon client | New FinnGen controllers, services, jobs, models, migrations, commands |
| `parthenon-horizon` | Job worker pool | New `finngen` queue alias; picks up `RunFinnGenAnalysisJob` |
| `parthenon-postgres` | Primary DB | New `app.finngen_runs` + `app.finngen_analysis_modules` tables; `parthenon_finngen_ro` + `parthenon_finngen_rw` roles |
| `parthenon-darkstar` | Darkstar | New `api/finngen/*.R` route files; extended `install_deps.R`; no architectural changes to existing endpoints |
| `parthenon-redis` | Horizon queue + sync-read cache + idempotency dedupe | Used as-is; new key namespaces `finngen:sync:*` and `finngen:idem:*` |
| **Deleted:** `parthenon-finngen-runner` | (gone) | Container + volumes removed from `docker-compose.yml` |

### 2.2 Boundaries & responsibilities

- **Laravel owns:** user identity, RBAC, run lifecycle (create/cancel/pin), source resolution, artifact access control, audit logging, polling scheduler, retry policy, GC.
- **Horizon owns:** job dispatch, retries with backoff, cancellation signaling, metrics.
- **Darkstar owns:** R package loading, mirai daemon pool, CDM connection management per-request, R-side job tracking (mirai task IDs → `/jobs/{id}`), artifact file writes, error classification.
- **Nobody owns "workbench session state"** in SP1 — that's SP4.

### 2.3 Explicitly not in the architecture

- No message queue between Laravel and Darkstar (HTTP + polling is enough; Horizon is the queue).
- No inter-container auth beyond Docker network isolation (existing pattern).
- No Redis pub/sub for progress (polling the Darkstar jobs API covers it).
- No service discovery beyond Docker DNS (`darkstar` resolves on `parthenon_backend`).

---

## 3. Data Flow

### 3.1 Sync read flow (foundation proxy; fully used by SP2+)

Example: "Get stratified code counts for concept 317009 on synpuf."

```
React                      Laravel                    Darkstar                Postgres
  │                           │                          │                       │
  │ GET /api/v1/finngen/sync/ │                          │                       │
  │   romopapi/code-counts    │                          │                       │
  │   ?source=synpuf          │                          │                       │
  │   &concept_id=317009      │                          │                       │
  ├──────────────────────────>│                          │                       │
  │                           │ auth + RBAC              │                       │
  │                           │ redis GET finngen:sync:..│                       │
  │                           │         ───HIT──>        │                       │
  │                           │       (return cached)    │                       │
  │                           │                          │                       │
  │                           │         ───MISS──>       │                       │
  │                           │ SourceContextBuilder     │                       │
  │                           │   ::build('synpuf', RO)  │                       │
  │                           │                          │                       │
  │                           │ POST /finngen/romopapi/  │                       │
  │                           │   code-counts            │                       │
  │                           ├─────────────────────────>│                       │
  │                           │                          │ build CDMdbHandler   │
  │                           │                          │ ROMOPAPI::           │
  │                           │                          │   getCodeCounts()    │
  │                           │                          ├──────────────────────>│
  │                           │                          │<──tibble─────────────│
  │                           │<─────200 JSON────────────│                       │
  │                           │ redis SETEX 3600         │                       │
  │<──────200 JSON────────────│                          │                       │
```

**Timing budget:** warm ~300ms end-to-end on miss, <50ms on hit. Cold (first request after Darkstar restart) ~5s due to `library(ROMOPAPI)` load on first mirai daemon assignment; subsequent requests <300ms.

**Error paths:** Darkstar 5xx → Laravel returns 502 with error ID. R exception inside `getCodeCounts` → Darkstar returns 422 with classified error (§5.5); Laravel passes through.

### 3.2 Async analysis flow (the main event)

Example: "Run CodeWAS on cohorts 42 vs 99 in synpuf."

```
React              Laravel              Horizon              Darkstar            FS/Postgres
  │                   │                    │                    │                     │
  │ POST /runs        │                    │                    │                     │
  │ body: {           │                    │                    │                     │
  │   analysis_type:  │                    │                    │                     │
  │   "co2.codewas",  │                    │                    │                     │
  │   source: "synpuf"│                    │                    │                     │
  │   params: {...}   │                    │                    │                     │
  │ }                 │                    │                    │                     │
  │ Idempotency-Key:  │                    │                    │                     │
  │   <uuid>          │                    │                    │                     │
  ├──────────────────>│                    │                    │                     │
  │                   │ middleware SETNX   │                    │                     │
  │                   │ auth + RBAC        │                    │                     │
  │                   │ ModuleReg validate │                    │                     │
  │                   │ INSERT finngen_runs│                    │                     │
  │                   │   status=queued    ├───────────────────────────────────────>│
  │                   │ Job::dispatch      ├───────────────────>│                     │
  │<──201 {run_id}────│                    │                    │                     │
  │                   │                    │                    │                     │
  │ (poll loop        │                    │                    │                     │
  │  every 3s→10s)    │                    │                    │                     │
  │ GET /runs/{id}    │                    │                    │                     │
  ├──────────────────>│                    │                    │                     │
  │<──{status:queued}─│                    │                    │                     │
  │                   │                    │ [worker picks up]  │                     │
  │                   │                    │ UPDATE status=     │                     │
  │                   │                    │   running          ├──────────────────>│
  │                   │                    │ SourceContextBldr  │                     │
  │                   │                    │   build(synpuf,RW) │                     │
  │                   │                    │ mkdir runs/{id}/   │                     │
  │                   │                    │ write params.json  │                     │
  │                   │                    │ POST /finngen/co2/ │                     │
  │                   │                    │   codewas          ├───────────────────>│
  │                   │                    │                    │ mirai::mirai({     │
  │                   │                    │                    │  CO2AnalysisModules│
  │                   │                    │                    │  ::execute_CodeWAS │
  │                   │                    │                    │ })                 │
  │                   │                    │<──{job_id: mt_abc} │                     │
  │                   │                    │   status: running  │                     │
  │                   │                    │ UPDATE darkstar_   ├──────────────────>│
  │                   │                    │   job_id=mt_abc    │                     │
  │                   │                    │                    │                     │
  │                   │                    │ [poll every 2s→5s] │                     │
  │                   │                    │ GET /jobs/mt_abc   ├───────────────────>│
  │                   │                    │<──{status:running, │                     │
  │                   │                    │   progress:{step:  │                     │
  │                   │                    │   "covariates",    │                     │
  │                   │                    │   pct:35}}         │                     │
  │                   │                    │ UPDATE progress    ├──────────────────>│
  │                   │                    │                    │                     │
  │ GET /runs/{id}    │                    │                    │                     │
  ├──────────────────>│                    │                    │                     │
  │<──{status:running,│                    │                    │                     │
  │   progress:{...}} │                    │                    │                     │
  │                   │                    │                    │ execute_CodeWAS    │
  │                   │                    │                    │  writes            │
  │                   │                    │                    │   results.duckdb  ──┤
  │                   │                    │                    │   summary.json    ──┤ FS
  │                   │                    │                    │   log.txt         ──┤
  │                   │                    │                    │ mirai exits done   │
  │                   │                    │ GET /jobs/mt_abc   ├───────────────────>│
  │                   │                    │<──{status:done,    │                     │
  │                   │                    │   artifacts:{...}, │                     │
  │                   │                    │   summary:{...}}   │                     │
  │                   │                    │ UPDATE status=     ├──────────────────>│
  │                   │                    │   succeeded        │                     │
  │                   │                    │ [worker exits]     │                     │
  │                   │                    │                    │                     │
  │ GET /runs/{id}    │                    │                    │                     │
  ├──────────────────>│                    │                    │                     │
  │<──{status:        │                    │                    │                     │
  │   succeeded,      │                    │                    │                     │
  │   artifacts:{...}}│                    │                    │                     │
```

**Timing budget:**
- Dispatch → `run_id` in response: <200ms
- `queued → running`: typically <1s
- `running → succeeded`: bounded by R analysis (CodeWAS on SynPUF: 5–15 min)
- React polling: 3s initial, exponential backoff to 10s

**Horizon worker poll cadence:** 2s for first 30s, 5s after that. Workers stay alive (sleeping between polls). Queue sizing: `max_processes = 4`, `timeout = 7200`.

**Progress convention:** R wrappers write newline-delimited JSON to `runs/{id}/progress.json`. Rotating buffer caps at 500 lines (§5.10). Darkstar's `/jobs/{id}` reads the latest line.

### 3.3 Artifact retrieval flow

```
React                          Laravel                     Shared Volume
  │                               │                              │
  │ GET /runs/{id}/artifacts/     │                              │
  │   results_db                  │                              │
  ├──────────────────────────────>│                              │
  │                               │ auth + RBAC + ownership      │
  │                               │ resolve                      │
  │                               │   artifacts['results_db']    │
  │                               │ stream file                  │
  │                               │ (X-Accel-Redirect via Nginx  │
  │                               │  for files >10MB)            │
  │<──────200 binary──────────────│<─────────────────────────────│
```

**Content-Type:** `.duckdb` → `application/vnd.duckdb`; `.html` → `text/html`; `.png` → `image/png`; `.json` → `application/json`; `.txt` → `text/plain`.

**Access control:** run is owned by `user_id`; request must match owner or be `admin`/`super-admin`. No signed sharing links in SP1.

### 3.4 Cancellation flow

```
React                  Laravel                 Horizon               Darkstar
  │                       │                       │                      │
  │ POST /runs/{id}/cancel│                       │                      │
  ├──────────────────────>│                       │                      │
  │                       │ auth + ownership      │                      │
  │                       │ UPDATE status=        │                      │
  │                       │   canceling           │                      │
  │<──202 accepted────────│                       │                      │
  │                       │                       │ [worker sees         │
  │                       │                       │  status=canceling]   │
  │                       │                       │ DELETE /jobs/mt_abc  │
  │                       │                       ├─────────────────────>│
  │                       │                       │                      │ mirai interrupt
  │                       │                       │                      │ 60s ceiling timer
  │                       │                       │<──{status:canceled}──│
  │                       │                       │ UPDATE status=       │
  │                       │                       │   canceled           │
```

See §5.6 for the 60s hard ceiling and force-recycle path.

### 3.5 Nightly GC flow

```
Horizon scheduler (3:45 AM daily)
  │
  ▼
php artisan finngen:prune-runs
  │
  │ SELECT id FROM app.finngen_runs
  │ WHERE finished_at < now() - interval '90 days'
  │   AND pinned = false
  │
  ├──> for each row:
  │      rm -rf /opt/finngen-artifacts/runs/{id}/
  │      DELETE FROM app.finngen_runs WHERE id = ?
  │
  └──> log count + freed bytes to audit log
```

### 3.6 Failure modes

See §5 for the complete error taxonomy. Summary mapping:

| Where | Failure | Behavior |
|---|---|---|
| Laravel controller | validation | 422; no run created |
| Laravel controller | auth/RBAC | 401/403 |
| Horizon dispatch | Redis down | 503; row stays `queued`; retry |
| Horizon worker | Darkstar unreachable | 3× retry (5s/30s/2min); then `failed` |
| Horizon worker | Darkstar 4xx | `failed` immediately (bad params) |
| Darkstar | R exception | pre-classified; surfaces via `/jobs/{id}`; `failed` with category |
| Darkstar | mirai daemon crash | task → `error`; supervisor spawns replacement; run `failed` |
| Horizon worker killed mid-run | orphan | periodic reconciler (15-min) finds + recovers |
| Shared volume | full | R write fails; telemetry alert |

### 3.7 Observability points

- State transitions emit `finngen.run.{created,started,progressed,succeeded,failed,canceled}` audit events. `progressed` throttled to 1/min.
- Timing histograms per `analysis_type` (p50/p95/p99) shipped to Loki/Grafana.
- Darkstar `/health` extended with `finngen: { packages_loaded, load_errors }`.
- `finngen` Horizon queue depth visible in Horizon dashboard.

---

## 4. API Contracts

### 4.1 Laravel REST API (React-facing)

All routes under `/api/v1/finngen/*`, all behind `auth:sanctum`, all RBAC-gated.

#### 4.1.1 Shared types

```ts
type FinnGenAnalysisType =
  | "romopapi.code_counts"          // sync
  | "romopapi.report"               // async
  | "hades.overlap"                 // sync
  | "hades.demographics"            // sync
  | "hades.counts"                  // sync
  | "co2.codewas"                   // async
  | "co2.time_codewas"              // async
  | "co2.overlaps"                  // async
  | "co2.demographics"              // async
  | "co2.gwas"                      // FLAG-GATED, not implemented in SP1
  | "cohort.generate"               // async
  | "cohort.match";                 // async

type FinnGenRunStatus =
  | "queued" | "running" | "canceling"
  | "succeeded" | "failed" | "canceled";

interface FinnGenRun {
  id: string;                       // ULID
  user_id: number;
  source_key: string;
  analysis_type: FinnGenAnalysisType;
  params: Record<string, unknown>;
  status: FinnGenRunStatus;
  progress: {
    step?: string;
    pct?: number;                   // 0–100
    message?: string;
    updated_at?: string;
  } | null;
  artifacts: Record<string, string>; // key → relative path under runs/{id}/
  summary: Record<string, unknown> | null;
  error: {
    code: string;                   // wrapper code (FINNGEN_* or DARKSTAR_R_*)
    category: string;               // R-side category when applicable
    message: string;
    stack?: string;                 // dev only
  } | null;
  pinned: boolean;
  artifacts_pruned: boolean;
  darkstar_job_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
    field_errors?: Record<string, string[]>;
    diagnostic_id?: string;
  };
}
```

#### 4.1.2 Run lifecycle endpoints

| Method | Path | Permission | Request | Response | Notes |
|---|---|---|---|---|---|
| `GET` | `/finngen/runs` | `analyses.view` | — | `{ data: FinnGenRun[], meta: {...} }` | query: `?status=&analysis_type=&source=&pinned=&page=&per_page=`; user-scoped (admins see all) |
| `POST` | `/finngen/runs` | `analyses.run` | `{ analysis_type, source_key, params }` + `Idempotency-Key` header | `201 FinnGenRun` | per-type schema validation; creates row, dispatches `RunFinnGenAnalysisJob` |
| `GET` | `/finngen/runs/{id}` | `analyses.view` + owner | — | `200 FinnGenRun` | polling target |
| `POST` | `/finngen/runs/{id}/cancel` | `analyses.run` + owner | — | `202 FinnGenRun` | idempotent on terminal state |
| `POST` | `/finngen/runs/{id}/pin` | `analyses.view` + owner | — | `200 FinnGenRun` | |
| `DELETE` | `/finngen/runs/{id}/pin` | `analyses.view` + owner | — | `200 FinnGenRun` | |

#### 4.1.3 Artifact endpoint

| Method | Path | Permission | Response | Notes |
|---|---|---|---|---|
| `GET` | `/finngen/runs/{id}/artifacts/{key}` | `analyses.view` + owner | binary stream | `key` must be in `run.artifacts`; content-type by extension; `X-Accel-Redirect` for files >10MB; `Content-Disposition: attachment` for `.duckdb`/`.html` |

#### 4.1.4 Sync read proxy endpoints

Thin proxies to Darkstar with Redis-side cache (key `finngen:sync:{endpoint}:{source_key}:{query_hash}`, TTL 3600s, `?refresh=true` bypasses).

| Method | Path | Permission | Darkstar target |
|---|---|---|---|
| `GET` | `/finngen/sync/romopapi/code-counts` | `analyses.view` | `GET /finngen/romopapi/code-counts` |
| `GET` | `/finngen/sync/romopapi/relationships` | `analyses.view` | `GET /finngen/romopapi/relationships` |
| `GET` | `/finngen/sync/romopapi/ancestors` | `analyses.view` | `GET /finngen/romopapi/ancestors` |
| `GET` | `/finngen/sync/hades/overlap` | `analyses.view` | `GET /finngen/hades/overlap` |
| `GET` | `/finngen/sync/hades/demographics` | `analyses.view` | `GET /finngen/hades/demographics` |
| `GET` | `/finngen/sync/hades/counts` | `analyses.view` | `GET /finngen/hades/counts` |

#### 4.1.5 Module registry endpoint

| Method | Path | Permission | Response |
|---|---|---|---|
| `GET` | `/finngen/analyses/modules` | `analyses.view` | `{ data: AnalysisModule[] }` |

SP1 seeds 4 entries (`co2.codewas`, `co2.time_codewas`, `co2.overlaps`, `co2.demographics`) with minimal columns. SP3 extends.

#### 4.1.6 Rate limiting

- `POST /finngen/runs`: 10/min/user
- Sync reads: 60/min/user
- Artifact retrieval: 120/min/user

### 4.2 Darkstar HTTP API (Laravel ↔ Darkstar)

Base URL: `http://darkstar:8787`. No auth header (network isolation).

#### 4.2.1 Shared request envelope

Every `/finngen/*` route accepts:

```json
{
  "source": {
    "source_key": "synpuf",
    "dbms": "postgresql",
    "connection": {
      "server": "postgres/parthenon",
      "port": 5432,
      "user": "parthenon_finngen_ro",
      "password": "..."
    },
    "schemas": {
      "cdm": "synpuf",
      "vocab": "vocab",
      "results": "synpuf_results",
      "cohort": "synpuf_results"
    }
  },
  "run_id": "01HXYZ...",
  "params": { /* per-endpoint */ }
}
```

Role chosen by endpoint type: `_ro` for sync reads, `_rw` for analyses writing to results/cohort schemas.

#### 4.2.2 Sync endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/finngen/romopapi/code-counts` | `{ concept, stratified_counts, node_count, descendant_count }` |
| `GET` | `/finngen/romopapi/relationships` | `{ relationships: [...] }` |
| `GET` | `/finngen/romopapi/ancestors` | `{ nodes, edges, mermaid }` |
| `GET` | `/finngen/hades/overlap` | `{ matrix, labels }` |
| `GET` | `/finngen/hades/demographics` | `{ age_histogram, gender_counts, total }` |
| `GET` | `/finngen/hades/counts` | `{ counts: [...] }` |

Target <10s per call; Laravel 30s timeout surfaces as 504 with suggestion to run as analysis.

#### 4.2.3 Async endpoints

All POST, return `{ job_id, status: "running" }` immediately, backed by mirai.

| Method | Path | Consumed by |
|---|---|---|
| `POST` | `/finngen/co2/codewas` | SP3 |
| `POST` | `/finngen/co2/time-codewas` | SP3 |
| `POST` | `/finngen/co2/overlaps` | SP3 |
| `POST` | `/finngen/co2/demographics` | SP3 |
| `POST` | `/finngen/romopapi/report` | SP2 |
| `POST` | `/finngen/cohort/generate` | SP4 |
| `POST` | `/finngen/cohort/match` | SP4 |

SP1 implements all seven as thin shells; validates source + params, spawns mirai task, returns job_id. SP1 tests `co2.codewas` against Eunomia.

#### 4.2.4 Job polling & cancellation (existing Darkstar surface, extended)

| Method | Path | Returns |
|---|---|---|
| `GET` | `/jobs/{job_id}` | `{ status, progress?, artifacts?, summary?, error? }` |
| `DELETE` | `/jobs/{job_id}` | `202`; idempotent |

#### 4.2.5 Health

| Method | Path | Returns |
|---|---|---|
| `GET` | `/health` (existing, extended) | `{ ok, mirai_daemons, packages: { ROMOPAPI, HadesExtras, CO2AnalysisModules, load_errors } }` |

### 4.3 `finngen_runs` schema

```sql
CREATE TABLE app.finngen_runs (
    id                  CHAR(26)    PRIMARY KEY,        -- ULID
    user_id             BIGINT      NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    source_key          VARCHAR(64) NOT NULL,
    analysis_type       VARCHAR(64) NOT NULL,
    params              JSONB       NOT NULL,
    status              VARCHAR(16) NOT NULL DEFAULT 'queued',
    progress            JSONB,
    artifacts           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    summary             JSONB,
    error               JSONB,
    pinned              BOOLEAN     NOT NULL DEFAULT FALSE,
    artifacts_pruned    BOOLEAN     NOT NULL DEFAULT FALSE,
    artifacts_pruned_at TIMESTAMPTZ,
    darkstar_job_id     VARCHAR(64),
    horizon_job_id      VARCHAR(64),
    reconciled_count    SMALLINT    NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT finngen_runs_status_check CHECK (status IN
      ('queued','running','canceling','succeeded','failed','canceled')),
    CONSTRAINT finngen_runs_terminal_requires_finished_at CHECK
      (status NOT IN ('succeeded','failed','canceled') OR finished_at IS NOT NULL)
);

CREATE INDEX finngen_runs_user_created_idx   ON app.finngen_runs (user_id, created_at DESC);
CREATE INDEX finngen_runs_status_idx         ON app.finngen_runs (status)
  WHERE status IN ('queued','running','canceling');
CREATE INDEX finngen_runs_gc_idx             ON app.finngen_runs (finished_at)
  WHERE pinned = false AND finished_at IS NOT NULL;
CREATE INDEX finngen_runs_analysis_type_idx  ON app.finngen_runs (analysis_type);
```

### 4.4 `finngen_analysis_modules` schema

```sql
CREATE TABLE app.finngen_analysis_modules (
    key               VARCHAR(64)  PRIMARY KEY,
    label             VARCHAR(128) NOT NULL,
    description       TEXT         NOT NULL,
    darkstar_endpoint VARCHAR(128) NOT NULL,
    enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
    min_role          VARCHAR(32)  NOT NULL DEFAULT 'researcher',
    settings_schema   JSONB,                          -- SP3 populates
    default_settings  JSONB,                          -- SP3 populates
    result_schema     JSONB,                          -- SP3 populates
    result_component  VARCHAR(64),                    -- SP3 populates
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.5 OpenAPI generation

- Uses existing `deploy.sh --openapi` pipeline.
- `FinnGenRun`, `FinnGenAnalysisType`, `FinnGenRunStatus`, `ApiError` registered as OpenAPI components.
- Per-type `params` schemas as `oneOf` discriminated by `analysis_type`. SP1 registers stub schemas for all 12 types; SP3/4 fill them out.
- OpenAPI snapshot committed at `backend/tests/Fixtures/openapi-finngen-snapshot.yaml`; drift test asserts parity.

### 4.6 Contract versioning

- `/api/v1/finngen/*` is v1. Breaking changes bump to v2.
- Darkstar's `/finngen/*` endpoints are internal — we change them freely; `FinnGenClient` adapts.
- `finngen_runs.params` is JSONB; params schemas evolve without migrations.

---

## 5. Error Handling, Failure Modes & Cancellation

### 5.1 Error taxonomy

Three layers:

| Layer | Prefix | Examples |
|---|---|---|
| Laravel validation/policy | `FINNGEN_` | `FINNGEN_INVALID_PARAMS`, `FINNGEN_UNKNOWN_ANALYSIS_TYPE`, `FINNGEN_SOURCE_NOT_FOUND`, `FINNGEN_NOT_OWNER`, `FINNGEN_TERMINAL_STATE`, `FINNGEN_DUPLICATE_IDEMPOTENCY_KEY` |
| Laravel ↔ Darkstar transport | `FINNGEN_DARKSTAR_` | `FINNGEN_DARKSTAR_UNREACHABLE`, `FINNGEN_DARKSTAR_TIMEOUT`, `FINNGEN_DARKSTAR_REJECTED`, `FINNGEN_DARKSTAR_MALFORMED_RESPONSE` |
| Darkstar / R execution (pre-classified R-side) | `DARKSTAR_R_` | `DARKSTAR_R_DB_CONNECTION_FAILED`, `DARKSTAR_R_DB_SCHEMA_MISMATCH`, `DARKSTAR_R_OUT_OF_MEMORY`, `DARKSTAR_R_PACKAGE_NOT_LOADED`, `DARKSTAR_R_ANALYSIS_EXCEPTION`, `DARKSTAR_R_MIRAI_TASK_CRASHED`, `DARKSTAR_R_TIMEOUT`, `DARKSTAR_R_DISK_FULL`, `DARKSTAR_R_CANCELED` |

Laravel wraps R errors without rewriting them. UI decisions use classification codes; debugging uses R detail.

### 5.2 Validation & input failure

Fails before any DB row or Horizon job:

| Condition | HTTP | Code |
|---|---|---|
| `analysis_type` unknown or disabled | 422 | `FINNGEN_UNKNOWN_ANALYSIS_TYPE` |
| `source_key` not found | 422 | `FINNGEN_SOURCE_NOT_FOUND` |
| `source_key` disabled | 422 | `FINNGEN_SOURCE_DISABLED` |
| `params` fails schema validation | 422 | `FINNGEN_INVALID_PARAMS` (with `field_errors`) |
| missing `analyses.run` permission | 403 | Laravel default |
| RateLimiter hit | 429 | standard |
| duplicate `Idempotency-Key`, different body | 409 | `FINNGEN_IDEMPOTENCY_CONFLICT` |

### 5.3 Idempotency on `POST /runs`

- Clients SHOULD include `Idempotency-Key: <uuid>`. React hook generates per-submit UUID, stable across re-renders + retries.
- Middleware `EnforceFinnGenIdempotency`:
  1. `fingerprint = sha256(user_id + idempotency_key + canonical_body)`
  2. `SETNX finngen:idem:{user_id}:{key} fingerprint EX 300`
  3. On SETNX success: proceed to controller; on 2xx, cache response body with same TTL
  4. On SETNX failure: if fingerprint matches, replay cached response; if differs, 409 `FINNGEN_IDEMPOTENCY_CONFLICT`
- Missing header → accepted, telemetry `finngen.idempotency.missing` for adoption audit.
- Redis outage → middleware degrades to "accept without dedupe" + emits `finngen.idempotency.redis_down` telemetry.

### 5.4 Transport failure (Laravel → Darkstar)

| Condition | Retry? | Run terminal code | Horizon |
|---|---|---|---|
| connection refused / DNS fail | 3× (5s/30s/2min) | `FINNGEN_DARKSTAR_UNREACHABLE` | retry with backoff |
| 5xx from Darkstar | 3× | `FINNGEN_DARKSTAR_UNREACHABLE` | same |
| 4xx from Darkstar on async dispatch | no | `FINNGEN_DARKSTAR_REJECTED` | `failed` immediately |
| malformed JSON | no | `FINNGEN_DARKSTAR_MALFORMED_RESPONSE` | `failed`; log body ≤4KB |
| client timeout (30s sync, 10s async dispatch, 120s poll) | yes | `FINNGEN_DARKSTAR_TIMEOUT` | retry |

Retry implemented in `RunFinnGenAnalysisJob` via `$tries` + `$backoff` + `failed()`. Sync proxies: no retry, 502/504 to React.

### 5.5 R execution failure — pre-classified R-side

PHP does no pattern matching on error messages. R-side wrapper in `darkstar/api/finngen/common.R`:

```r
run_with_classification <- function(export_folder, fn) {
  withCallingHandlers(
    tryCatch({
      result <- fn()
      list(ok = TRUE, result = result)
    },
    DatabaseConnectorError = function(e) finngen_error("DB_CONNECTION_FAILED", e),
    SqlRenderError         = function(e) finngen_error("DB_SCHEMA_MISMATCH",   e),
    OutOfMemoryError       = function(e) finngen_error("OUT_OF_MEMORY",        e),
    simpleError = function(e) classify_simple_error(e, export_folder)),
    warning = function(w) invokeRestart("muffleWarning")
  )
}
```

`classify_simple_error` inspects condition classes and known package markers (`AndromedaError`, `.jcall` signatures) to emit a `DARKSTAR_R_*` category. Generic unknown errors → `ANALYSIS_EXCEPTION`.

R wrapper writes to `runs/{id}/result.json`. Darkstar's `/jobs/{id}` surfaces `error.category`.

PHP's `FinnGenErrorMapper` is a pure lookup table:

```php
match ($darkstarCategory) {
  'DB_CONNECTION_FAILED' => __('finngen.errors.db_connection_failed'),
  'DB_SCHEMA_MISMATCH'   => __('finngen.errors.db_schema_mismatch'),
  'OUT_OF_MEMORY'        => __('finngen.errors.out_of_memory'),
  'ANALYSIS_EXCEPTION'   => __('finngen.errors.analysis_exception'),
  // ...
};
```

Adding a category = one R branch + one translation key. No regex.

### 5.6 Cancellation contract (hard 60s ceiling)

**Guarantees:**
1. `POST /runs/{id}/cancel` returns 202 within 200ms; never blocks.
2. Within ≤60s, run transitions to `canceled` OR completes naturally.
3. Idempotent on terminal state.
4. Partial artifacts preserved on disk (until GC); not exposed via API unless `status=succeeded`.

**Implementation:**
- Laravel: `running → canceling`
- Horizon worker sees `canceling` on next poll → `DELETE /jobs/{darkstar_job_id}`
- Darkstar's cancel handler:
  1. Calls mirai task interrupt (SIGINT)
  2. Starts 60s timer
  3. Polls mirai every 2s
  4. If canceled ≤60s: returns 202 (normal path)
  5. If still running at 60s: **force-recycle the mirai daemon slot** (`mirai::daemons(..., restart=TRUE)` targeted). Emit `finngen.cancel.forced`. Returns 202 `{ forced: true }`.
- Horizon worker writes `status=canceled`, `error={ category: 'CANCELED', forced: <bool> }`

**Race handling:**
- Natural completion wins over pending cancel. Sequence `canceling → succeeded` or `canceling → failed` is fine.
- Only explicit mirai-delivered cancellation yields `status=canceled`.

### 5.7 Orphan reconciliation — boot + periodic

**Boot-time reconciler:**
- Runs once at Horizon worker pool startup
- Scope: runs in `running`/`canceling` with `updated_at > now() - interval '1 hour'`

**Periodic reconciler (the real fix):**
- Horizon scheduled command: `php artisan finngen:reconcile-orphans` on `*/15 * * * *`
- Scope: runs in `running`/`canceling` with `updated_at < now() - interval '2 minutes'`
- For each:
  1. `darkstar_job_id` null → mark `failed` with `FINNGEN_WORKER_INTERRUPTED`
  2. Else `GET /jobs/{id}` on Darkstar:
     - `done` → copy result, `succeeded`
     - `error` → copy error, `failed`
     - `canceled` → mark `canceled`
     - `running` → re-dispatch `RunFinnGenAnalysisJob` with `resume_mode=true` (picks up polling from existing `darkstar_job_id`)
     - 404 → mark `failed` with `DARKSTAR_R_MIRAI_TASK_CRASHED`
- Lock via `Cache::lock('finngen:reconcile-orphans', 60)` to prevent overlap
- Bumps `reconciled_count`; if ≥3, force-fail the run (prevents dispatch loops on Darkstar misreport)

Emits `finngen.orphan.reconciled`.

### 5.8 Retry & idempotency

- `POST /runs` idempotent via `Idempotency-Key`
- `cancel`/`pin`/`DELETE pin` idempotent by state transition
- Transport errors retried per §5.4; R errors not retried

### 5.9 Artifact integrity & weekly sweeper

| Condition | Behavior |
|---|---|
| `artifacts[key]` → missing file | 410 Gone with `FINNGEN_ARTIFACT_PRUNED`; telemetry |
| artifact written but run ended `failed`/`canceled` | not exposed via API; file may exist until GC |
| volume full during R write | `DARKSTAR_R_DISK_FULL`; telemetry alert |

**Weekly sweeper:** `php artisan finngen:sweep-artifacts` runs Sunday 4am:

1. For each `succeeded` run with non-empty `artifacts`: stat each file; if any missing, set `artifacts={}`, `artifacts_pruned=true`, `artifacts_pruned_at=now()`
2. For each dir under `/opt/finngen-artifacts/runs/` with no matching `finngen_runs` row: delete (zombie cleanup)
3. Telemetry: `finngen.sweep.completed { runs_marked_pruned, zombie_dirs_removed, bytes_freed }`

### 5.10 Progress file rotation

`runs/{id}/progress.json` rotating buffer: cap 500 lines (~100KB ceiling). R-side `write_progress()` helper in `common.R`: reads current file, if >500 lines drops oldest 100, appends. Atomic via temp-file-then-rename.

If future analyses need unbounded history, add separate `progress.log` uncapped; UI reads the rotated file.

### 5.11 Observability fields

Lifecycle telemetry includes:
- `wrapper_code` — Laravel code
- `darkstar_code` — nullable, `DARKSTAR_R_*` category
- `r_class` — nullable, original R condition class
- `forced_cancel` — boolean
- `reconciled_by` — nullable (`boot` | `periodic`)

Grafana panels (post-SP1 ops task): error counts by wrapper_code and darkstar_code; forced-cancel rate (alert >3/hr); orphan reconciliation rate (alert >1/hr sustained).

### 5.12 Testing roster for error paths

~28 Pest feature tests:
- Validation (§5.2): 7
- Idempotency (§5.3): 4
- Transport (§5.4): 4
- R execution (§5.5): 3 against Eunomia
- Cancellation (§5.6): 4 incl. forced 60s case
- Orphan reconciliation (§5.7): 3
- Artifact sweeper (§5.9): 2
- Progress rotation (§5.10): 1 testthat unit test

Part of SP1's Definition of Done.

---

## 6. Testing Strategy

### 6.1 Inventory

| Layer | Framework | Count (SP1) | Coverage floor |
|---|---|---|---|
| Laravel unit | Pest | ~40 | 90% of `Services/FinnGen/*`, `Jobs/FinnGen/*`, `Http/Middleware/EnforceFinnGenIdempotency` |
| Laravel feature | Pest | ~28 | every route in §4.1 hit; every error code in §5.1 produced |
| R unit | testthat | ~15 | every function in `common.R`; every `run_with_classification` branch |
| R integration | testthat | ~10 | every `/finngen/*` Plumber route hit against Eunomia |
| Frontend unit | Vitest | ~8 | `useFinnGenRun`, `useFinnGenSyncRead`, idempotency-key generator |
| E2E | Playwright | 2 | sync-read full trip; async-run lifecycle with cancel |

Total ~103 tests. Budget ~4 days of ~2-week SP1 envelope.

### 6.2 Laravel — unit

In `backend/tests/Unit/FinnGen/`:

- `FinnGenClientTest` — `Http::fake()`: success, transport, 4xx/5xx/malformed, timeout, request envelope
- `FinnGenRunServiceTest` — creation, transitions, RBAC, params validation; in-memory SQLite
- `FinnGenSourceContextBuilderTest` — seeded sources → correct config; RO vs RW roles; disabled sources rejected; password decryption
- `FinnGenArtifactServiceTest` — signed URL generation, path traversal rejection, content-type, streaming threshold
- `FinnGenErrorMapperTest` — every `DARKSTAR_R_*` maps to translation key; unknown → generic
- `EnforceFinnGenIdempotencyTest` — SETNX, replay, 409, TTL, missing-header telemetry, Redis outage degradation
- `FinnGenAnalysisModuleRegistryTest` — enabled/disabled, min_role filtering

Mocking: mock Darkstar HTTP (`Http::fake`), never mock DB. Real Eloquent + Postgres test DB.

### 6.3 Laravel — feature

In `backend/tests/Feature/FinnGen/`:

- `FinnGenRunsLifecycleTest` — POST → queued → running → succeeded → artifact; `Http::fake()` + `Queue::fake()`
- `FinnGenRunsCancellationTest` — §5.6 race matrix
- `FinnGenRunsValidationTest` — §5.2 roster
- `FinnGenRunsRBACTest` — unauth / no-perm / non-owner / owner matrix per route
- `FinnGenSyncReadsTest` — cache hit/miss, `?refresh`, 502/504 mapping
- `FinnGenIdempotencyTest` — §5.3 full roster
- `FinnGenOrphanReconcilerTest` — boot + periodic
- `FinnGenArtifactSweeperTest` — §5.9
- `FinnGenGCCommandTest` — 90-day prune
- `FinnGenHealthProbeTest` — `/api/v1/health` reflects Darkstar state

Patterns: `Http::fake(['darkstar:8787/*' => ...])`; `Queue::fake()` / `Bus::fake()`; `RefreshDatabase`; seeded fixtures via `FinnGenTestingSeeder`; real Redis for idempotency via `docker-compose.test.yml`.

### 6.4 Darkstar R — testthat

In `darkstar/tests/testthat/`:

- `test-finngen-common.R` — every `run_with_classification` branch; `classify_simple_error` Java-JDBC signatures; `write_progress` rotating buffer
- `test-finngen-romopapi.R` — 3 sync endpoints against Eunomia; numeric correctness; edge cases
- `test-finngen-hades.R` — 3 sync endpoints (overlap, demographics, counts)
- `test-finngen-co2-codewas.R` — one end-to-end CodeWAS on Eunomia (~30s)
- `test-finngen-cohort-generate.R` — materialize Capr cohort; verify row in `eunomia.cohort`
- `test-finngen-cancel.R` — graceful cancel in <10s; forced cancel at 60s with SIGINT-ignoring task

Constraints: Eunomia-only fixtures; tests <60s individually. Run via `docker compose exec darkstar Rscript -e 'testthat::test_dir("/app/tests/testthat")'` (new Makefile target).

### 6.5 Frontend — Vitest

In `frontend/src/features/_finngen-foundation/__tests__/`:

- `useFinnGenRun.test.tsx` — polling cadence, stop on terminal, cache reuse, 404, 410
- `useFinnGenSyncRead.test.tsx` — `?refresh=true`, cached returns, 502 error state
- `idempotencyKey.test.ts` — stable across re-renders, new on each mutate
- `RunStatusBadge.test.tsx` — stub per status; design tokens

### 6.6 E2E — Playwright

Against docker-compose stack with seeded Eunomia, gated `@slow`:

- `finngen-code-counts.spec.ts` — login, hit sync-read hook, assert shape
- `finngen-codewas-lifecycle.spec.ts` — login, dispatch CodeWAS on Eunomia, poll to completion, fetch artifact, cancel variant within 15s

Nightly + main-branch merge, not every PR.

### 6.7 Out of SP1 (flagged for SP3)

- 10 concurrent CodeWAS load test against SynPUF
- 1000-run history page load
- Orphan reconciler under 500 stale rows

### 6.8 Fixtures & data

- `database/seeders/Testing/FinnGenTestingSeeder.php` — 2 sources (eunomia + fake-disabled), 4 analysis modules, 1 user per role; idempotent; shared by Pest + Playwright
- Eunomia seeded by existing `php artisan parthenon:load-eunomia --fresh` (lazy-seed on empty `eunomia.cohort`)
- Mock Darkstar responses in `backend/tests/Fixtures/darkstar/`

### 6.9 Drift detection

- **OpenAPI snapshot test** — Pest test renders spec, compares to `backend/tests/Fixtures/openapi-finngen-snapshot.yaml`; regenerate intentionally via `php artisan finngen:snapshot-openapi`
- **Darkstar shape test** — testthat runs real endpoints, asserts JSON shape matches `darkstar/tests/fixtures/darkstar-finngen-shapes.json`

Both committed; updates are deliberate PR steps.

### 6.10 CI

New `.github/workflows/finngen-tests.yml`:
- Fast lane (PR gate): Pest (Unit + Feature without `@slow`), Vitest, testthat — ~4 min
- Slow lane (nightly + main): Playwright, Pest `@slow`, R integration on Eunomia — ~15 min
- Coverage uploaded; fails PR if total <80% or `app/Services/FinnGen/**` <90%

### 6.11 Deliberately NOT tested in SP1

- UI rendering of full Code Explorer / Analysis Gallery / Cohort Workbench
- GWAS
- Atlas WebAPI import
- Drag-and-drop operation builder
- Multi-host deployment
- Performance regression benchmarks

---

## 7. Migration & Rollout

### 7.1 Pre-merge checklist

- [ ] All Pest + testthat + Vitest tests green (~103 tests)
- [ ] OpenAPI snapshot regenerated and committed
- [ ] Darkstar response-shape snapshot regenerated and committed
- [ ] `docker compose config --quiet` passes
- [ ] `php artisan route:list` shows all `/finngen/*` routes with expected middleware
- [ ] `docker compose exec darkstar Rscript -e 'library(ROMOPAPI); library(HadesExtras); loadNamespace("CO2AnalysisModules"); cat("ok\n")'` prints `ok`
- [ ] HIGHSEC §2.3 route-addition checklist ticked per route in PR description
- [ ] Pint + PHPStan L8 + tsc --noEmit + vite build + ESLint all green
- [ ] Code review via `gsd-code-reviewer`
- [ ] Devlog `docs/devlog/modules/finngen/sp1-runtime-foundation.md` written
- [ ] `scripts/darkstar-version-check.sh` updated for the three new packages

### 7.2 Migration order (single PR, `./deploy.sh`)

1. **Pre-deploy** — `git status` clean; confirm `./scripts/db-backup.sh` ran recently
2. **Migrations** (`deploy.sh --db`):
   - `create_finngen_runs_table` (includes `artifacts_pruned`, `artifacts_pruned_at`, `reconciled_count` columns from §4.3)
   - `create_finngen_analysis_modules_table`
   - `seed_finngen_analysis_modules` (data migration — 4 rows)
   - `create_finngen_readonly_role` (DDL; creates `parthenon_finngen_ro` + `_rw`)
3. **Docker rebuilds**
   - Darkstar image (R packages add ~25 min first build; subsequent cached)
   - Nginx config adds `/_artifacts/` internal location for `X-Accel-Redirect`
4. **Volume creation** — `finngen-artifacts` via compose up
5. **Service restart order** (Darkstar first)
   - `docker compose up -d --build darkstar` → wait for `/health.finngen.load_errors: []`
   - `docker compose up -d --build php horizon nginx`
   - `docker compose down finngen-runner`; keep old volumes 30 days for rollback
6. **Deploy** (`deploy.sh --php`) — caches + autoload
7. **Frontend rebuild** (`deploy.sh --frontend`) — regenerated types only
8. **Post-deploy verification**
   - `curl -s https://parthenon.acumenus.net/api/v1/health | jq '.finngen'` → `{ ready: true, packages_loaded: [...] }`
   - `php artisan finngen:smoke-test` → pass
   - Horizon dashboard shows `finngen` queue with 0 jobs

### 7.3 Rollback

`git revert <sp1-merge-sha> && ./deploy.sh`. Caveats:
- **No migration rollback** — additive tables, empty on rollback; leave in place. Per project rule, never destructive migrations without authorization.
- **PG roles stay** — no ownership; safe to leave.
- **R packages stay installed** — don't interfere with HADES; listed in monthly audit.
- **Artifact volume stays empty** — safe.

**Partial rollback**: if Darkstar broken but PHP deployed, `finngen_runs` accumulate as `failed`. Mitigation: `php artisan finngen:pause-dispatch` feature flag makes `POST /finngen/runs` return 503 until cleared. Noop on cache outage → back to open.

### 7.4 Removals (same PR)

**Code:**
- `docker/finngen-runner/`
- `external/finngen/finngen-runner/`
- `backend/app/Services/StudyAgent/FinnGen*.php` (9 files)
- `backend/app/Models/App/FinnGenRun.php` (replaced by `app/Models/App/FinnGen/Run.php`)
- FinnGen methods in `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`
- `frontend/src/features/workbench/toolsets.ts`
- `frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx`
- `frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx`

**Compose:**
- `finngen-runner` service, `finngen-runner-state`, `finngen-runner-r-lib` volumes
- `FINNGEN_RUNNER_*` env entries

**Routes (`backend/routes/api.php`):**
- All `/api/v1/study-agent/finngen-*` routes

**Frontend router:**
- Any `/workbench` routes pointing to deleted components

**OpenAPI:** regenerate.

**Sanity check (part of PR verification):**
```bash
grep -r "FinnGenWorkbenchService\|FinnGenCo2Service\|FinnGenRomopapiService\|finngen-runner" \
  backend/ frontend/ docker/ docker-compose.yml
# → zero results
```

### 7.5 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| R package install fails on Darkstar build | medium | blocks deploy | Pin versions in `install_deps.R`; test image build via `.github/workflows/darkstar-image.yml` pre-merge |
| HADES version conflict with new FinnGen packages | medium | breaks existing endpoints | Extended monthly audit pre-merge; resolve via version constraints |
| Shared volume permissions differ between containers | high | R writes PHP can't read | Entrypoints set umask 002, shared GID; Playwright artifact test |
| `parthenon_finngen_rw` lacks perms on `*_results` | medium | first-run analyses fail | Explicit grants in DDL migration; smoke test on first use per source |
| Horizon pool exhausted by long FinnGen jobs | low | queue backs up | Dedicated `finngen` queue, `max_processes=4` |
| Nginx `X-Accel-Redirect` config regression | low | artifacts 500 | Playwright artifact E2E; keep config in separate `include` |
| mirai daemons hold stale DB connections across Postgres restart | medium | `SQLSTATE[08006]` | R wrapper reconnects on conn errors; smoke test covers PG bounce |
| Orphan reconciler dispatches in a loop on Darkstar misreport | low | storm | `reconciled_count` cap at 3; force-fail after |
| Idempotency middleware hits Redis during outage | low | dispatches 5xx | Degrade to "accept without dedupe" + telemetry |

### 7.6 Runbook (`docs/devlog/modules/finngen/runbook.md`)

- Health checks: `finngen:smoke-test`, `finngen:health`, `finngen:pause-dispatch`, `finngen:reconcile-orphans --dry-run`
- How to force-kill a stuck mirai task (last resort)
- How to read `finngen_runs.error` + cross-reference Loki via `diagnostic_id`
- Clear idempotency namespace: `redis-cli --scan --pattern 'finngen:idem:*' | xargs redis-cli del`
- Inspect artifacts: `duckdb /opt/finngen-artifacts/runs/{id}/results.duckdb`
- Monthly HADES audit (extended)
- Rollback procedure (§7.3)

### 7.7 Communication

- **Internal** (solo shop): devlog post at merge; link runbook
- **External researchers**: no announcement — SP1 is invisible. First user-visible announcement is SP2 merge
- **Changelog**: per global rule, only on GitHub release — not per SP

### 7.8 Success criteria (7-day post-deploy)

1. Zero regressions on existing StudyAgent/HADES flows
2. `finngen:smoke-test` passes every CI run + nightly
3. Darkstar `/health.finngen.ready: true` continuously
4. Zero orphan reconciliations first 48h (no runs = no orphans); periodic logs "0 stale"
5. Zero `FINNGEN_DARKSTAR_MALFORMED_RESPONSE` in Loki (contract bug signal)
6. Artifact volume <100MB first week
7. No PG connection count regression (>3 above baseline)

If 1/3/5 fail → §7.3 rollback.

### 7.9 Post-SP1 follow-ups (non-blocking)

- Decommission `finngen-runner-state` + `finngen-runner-r-lib` volumes 30 days post-merge
- Grafana "FinnGen errors" panel per §5.11
- Benchmark one CodeWAS on SynPUF for production latency baseline (informs SP3 timeouts)
- Populate `lang/en/finngen.php` translation keys (SP1 creates file; may need community contributions)

---

## Appendix A — Cross-references

- Deferred sub-projects: `2026-04-12-finngen-workbench-subprojects-handoff.md`
- HIGHSEC requirements: `.claude/rules/HIGHSEC.spec.md`
- Auth system rules (unchanged): `.claude/rules/auth-system.md`
- Darkstar infrastructure: `~/.claude/memory/reference_parthenon_infra.md`
- PG role model: `~/.claude/memory/project_parthenon_pg_roles.md`
- Worktree sweep protocol (applies to implementation PRs): `~/.claude/rules/common/agents.md`

## Appendix B — Glossary

- **Darkstar** — Parthenon's HADES execution service (`parthenon-darkstar`, port 8787). Plumber2 + mirai 3-daemon worker pool.
- **mirai** — R async task queue backing `@async` Plumber endpoints.
- **HadesExtras** — R6 plumbing over HADES packages; `CDMdbHandler`, `CohortTableHandler`, operation-string SQL compiler.
- **ROMOPAPI** — upstream Plumber service for code counts. We import functions; don't run their server.
- **CohortOperations2 / CO2** — upstream Shiny workbench. **Not installed**; replaced natively in SP4.
- **CO2AnalysisModules** — upstream Shiny gallery. Install for `execute_*` functions only; never `library()`.
- **operation string** — HadesExtras' set-operation representation (`"(1 UNION 2) MINUS 3"`).
- **Eunomia** — small demo OMOP dataset seeded with Darkstar; only safe test fixture.
- **mirai daemon** — long-lived R subprocess; 3 are supervised by Darkstar's valve launcher.
