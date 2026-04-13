# FinnGen Workbench — Sub-Projects 2–4 Handoff

**Date:** 2026-04-12
**Status:** Deferred — not to be started until Sub-Project 1 (Runtime Foundation) is complete and merged
**Depends on:** `2026-04-12-finngen-runtime-foundation-design.md`
**Purpose:** Comprehensive handoff for the three downstream sub-projects that will be designed and executed after the runtime foundation ships. Each sub-project gets its own full brainstorm → spec → plan → implementation cycle; this document carries forward the shared context so future sessions start with ground truth instead of re-deriving it.

---

## 0. Cross-cutting context (read first)

### 0.1 Ground truth about the four FinnGen upstream packages

Summarized from the deep assessment completed 2026-04-12 (see `docs/devlog/modules/finngen/` for the raw report). Treat these as invariants; all downstream design must match upstream intent, not reinvent it.

| Package | What it really is | How we use it |
|---|---|---|
| **ROMOPAPI** | Plumber HTTP service for stratified OMOP code counts, concept hierarchy/relationship traversal. Memoized, report-generating. | Install the package; call `ROMOPAPI::getCodeCounts()`, `ROMOPAPI::createReport()` directly from our own Darkstar Plumber routes. **Do not** use upstream `runApiServer()`. |
| **HadesExtras** | R6 plumbing layer (`CDMdbHandler`, `CohortTableHandler`) wrapping `CohortGenerator`, `FeatureExtraction`, `DatabaseConnector`, `SqlRender`, `Andromeda`. Operation-string SQL compiler, matching subset operators, overlap/demographic computations. | Library, called via Darkstar Plumber routes. Stateless from our perspective: Laravel passes connection config + cohort definitions + operations, R returns tibbles. No session state in R. |
| **CohortOperations2 (CO2)** | Shiny workbench for import → operate → match → export. Stateful in-browser session. Drag-and-drop operation builder, Atlas/file/library import, matching UI, WebAPI export. | **We do not install this package.** We replicate its UX natively in React + Laravel, calling HadesExtras directly for the underlying operations. This is Sub-Project 4. |
| **CO2AnalysisModules** | Shiny gallery of `execute_*` functions for downstream analyses: CodeWAS, timeCodeWAS, CohortOverlaps, CohortDemographics, GWAS. Writes per-run DuckDB result files. Modules are pluggable via `analysisModulesConfig.yml` (settings UI fn + execute fn + results UI fn triples). | Install the package for its `execute_*` functions only. Never `library()` it (Shiny deps pollute the namespace). Call `CO2AnalysisModules::execute_CodeWAS(...)` etc. from Darkstar async Plumber routes. Replicate the settings UI and results UI in React. |

### 0.2 What Sub-Project 1 delivers (foundation contracts)

By the time Sub-Project 2 starts, these will be in place and usable:

1. **Darkstar R runtime** hosts ROMOPAPI, HadesExtras, CO2AnalysisModules. Monthly HADES audit (`scripts/darkstar-version-check.sh`) extended to cover new packages.
2. **Darkstar Plumber routes** under `darkstar/api/finngen/`:
   - Sync endpoints (fast reads) — behave like existing `/characterization`, `/cohort_diagnostics` routes
   - Async endpoints (analyses) — return `{ job_id, status: "running" }`, backed by mirai daemons; polled via Darkstar's native `GET /jobs/{id}`
   - Every endpoint takes a `source` object with full connection config (see §0.5)
3. **Laravel service layer** — `app/Services/FinnGen/` replaces the old `StudyAgent/FinnGen*.php` layer:
   - `FinnGenClient` — HTTP client to Darkstar (extends the existing `HadesBridgeService` pattern)
   - `FinnGenRunService` — creates `finngen_runs` rows, dispatches `RunFinnGenAnalysisJob`, updates status from Darkstar polling
   - `FinnGenArtifactService` — signs/streams artifacts from the shared volume with RBAC
   - `FinnGenSourceContextBuilder` — resolves a Parthenon `source_key` → connection-config payload Darkstar expects
4. **`finngen_runs` table** in `app` schema:
   - `id`, `user_id`, `source_key`, `analysis_type` (enum: `romopapi.code_counts`, `hades.overlap`, `hades.demographics`, `co2.codewas`, `co2.time_codewas`, `co2.overlaps`, `co2.demographics`, `co2.gwas`, `cohort.generate`, `cohort.match`), `params` (JSON), `darkstar_job_id` (nullable, for async), `status` (enum: `queued`, `running`, `succeeded`, `failed`, `canceled`), `progress` (JSON), `artifacts` (JSON map of `{ key: relative_path }`), `error` (JSON), `pinned` (bool, default false), `started_at`, `finished_at`, timestamps
5. **Shared artifact volume** — `finngen-artifacts` Docker volume, mounted `/opt/finngen-artifacts` in both `darkstar` and `php`. R writes to `runs/{run_id}/`, Laravel reads via signed-URL controller.
6. **Routes** (all under `auth:sanctum` + RBAC; cf. HIGHSEC.spec.md §2):
   - `GET    /api/v1/finngen/runs` — list (requires `analyses.view`)
   - `POST   /api/v1/finngen/runs` — dispatch (requires `analyses.run`, dispatches Horizon job)
   - `GET    /api/v1/finngen/runs/{id}` — status + progress + artifact index
   - `POST   /api/v1/finngen/runs/{id}/cancel` — cancel (propagates to Darkstar `DELETE /jobs/{darkstar_job_id}`)
   - `POST   /api/v1/finngen/runs/{id}/pin` / `DELETE .../pin`
   - `GET    /api/v1/finngen/runs/{id}/artifacts/{key}` — signed-URL streaming, content-type by extension
   - `GET    /api/v1/finngen/sync/romopapi/code-counts` — sync proxy (for sub-project 2 before it builds its own hooks)
   - `GET    /api/v1/finngen/sync/hades/overlap` / `.../demographics` / `.../counts` — sync proxies
7. **OpenAPI types** regenerated to `frontend/src/types/api.generated.ts`.
8. **90-day GC** — `php artisan finngen:prune-runs` (nightly Horizon cron) deletes `finngen_runs` rows + artifact directories where `finished_at < now() - 90 days AND pinned = false`.

### 0.3 Removed/replaced in Sub-Project 1

The following **no longer exist** once foundation ships — do not reference them:

- `docker/finngen-runner/` directory (deleted)
- `external/finngen/finngen-runner/` (deleted; the Python `ThreadingHTTPServer` is gone)
- `finngen-runner` service + `finngen-runner-state` + `finngen-runner-r-lib` volumes in `docker-compose.yml` (deleted)
- `backend/app/Services/StudyAgent/FinnGen*.php` (9 files, all deleted)
- `backend/app/Models/App/FinnGenRun.php` (replaced by `app/Models/App/FinnGen/Run.php` with a different schema)
- `backend/app/Http/Controllers/Api/V1/StudyAgentController.php` — FinnGen methods removed; the FinnGen concern moves out of StudyAgent entirely into a new `Api/V1/FinnGen/` controller namespace
- `frontend/src/features/workbench/toolsets.ts` (deleted; workbench feature is rebuilt from scratch in SP4)
- `frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx` (deleted)
- `frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx` (deleted)
- `backend/routes/api.php` — all routes under `/api/v1/study-agent/finngen-*` removed; replaced with `/api/v1/finngen/*`

### 0.4 Upstream reference locations (for reading, not modification)

- `external/finngen/ROMOPAPI/R/` — `getCodeCounts.R`, `createReport.R`, plumber.R (for endpoint shape reference only)
- `external/finngen/HadesExtras/R/` — `CDMdbHandler.R`, `CohortTableHandler.R`, `operationStringToSQL.R`, `CohortGenerator_*.R`, `FeatureExtraction_*.R`
- `external/finngen/CohortOperations2/R/` — `mod_operateCohorts_*.R`, `mod_matchCohorts_*.R`, `mod_importCohortsFromAtlas_*.R`, `mod_cohortWorkbench_*.R` (read for UX behavior to replicate in React)
- `external/finngen/CO2AnalysisModules/R/` — `execute_*.R` (the actual functions we call), `mod_analysisSettings_*_*.R` + `mod_resultsVisualisation_*_*.R` (read for settings fields + result columns to replicate in React)
- `external/finngen/CO2AnalysisModules/inst/analysisModulesConfig.yml` — module registry format (for reference; we replace this with a Laravel DB table or seeder)

### 0.5 The `source` payload shape (contract with Darkstar)

Every FinnGen call includes a `source` object. Built by `FinnGenSourceContextBuilder::build($sourceKey)` from `app.sources` + `app.source_daimons`:

```json
{
  "source_key": "synpuf",
  "label": "CMS SynPUF 2.3M",
  "dbms": "postgresql",
  "connection": {
    "server": "postgres/parthenon",
    "port": 5432,
    "user": "parthenon_finngen",
    "password": "<decrypted from app.sources at dispatch time>"
  },
  "schemas": {
    "cdm": "synpuf",
    "vocab": "vocab",
    "results": "synpuf_results",
    "cohort": "synpuf_results"
  }
}
```

Two DB roles (per Sub-Project 1 decision):
- `parthenon_finngen_ro` — for sync reads (ROMOPAPI, demographics, overlap)
- `parthenon_finngen_rw` — for analyses that write to `*_results` / cohort tables (CodeWAS, cohort generation, matching)

The role is chosen by endpoint type inside `FinnGenSourceContextBuilder`, not by the caller.

---

## 1. Sub-Project 2 — ROMOPAPI Code Explorer

### 1.1 Why this one first

- Smallest user-facing surface: one feature, one page, ~4 React components
- Uses only sync endpoints (no async, no cohort state, no DuckDB) — validates the foundation with the simplest possible consumer
- Delivers real user value on its own: clinical informaticists can look up a concept and see stratified counts before defining any cohort
- Shakes out the Darkstar HADES-audit workflow and the `FinnGenSourceContextBuilder` pattern before cohort work piles on

### 1.2 User outcome

A researcher opens "Code Explorer" (new route `/finngen/explore`), picks a source + enters a concept ID (or searches by name through existing `/api/v1/concepts/search`), and sees:

- Concept metadata (name, domain, vocabulary, concept_class_id, standard_concept)
- **Stratified code counts** — a stacked bar chart of counts by calendar_year × gender × age_decile, with both "node" (direct code) and "descendant" (hierarchical) counts toggleable
- **Concept relationships** — a reactable table of `concept_relationship` rows (Maps to, Mapped from, Is a, Subsumes, RxNorm has tradename, etc.) with click-to-explore
- **Ancestor/descendant tree** — rendered from `concept_ancestor` as a collapsible tree or Mermaid DAG (upstream ROMOPAPI ships Mermaid output — consume the string, render with `mermaid` npm package in an iframe sandbox)
- **Report button** — downloads the HTML report from `ROMOPAPI::createReport()` via the artifact endpoint (this *is* async — but exactly one artifact, one polling loop; good first exercise of the async path from the foundation)

### 1.3 Backend additions (thin — most is foundation)

- `app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php`
  - `GET /api/v1/finngen/code-explorer/counts?source=X&concept_id=Y` → proxies to Darkstar `/finngen/romopapi/code-counts`, returns JSON
  - `GET /api/v1/finngen/code-explorer/relationships?source=X&concept_id=Y` → proxies to Darkstar `/finngen/romopapi/relationships`
  - `GET /api/v1/finngen/code-explorer/ancestors?source=X&concept_id=Y&direction=up|down|both` → proxies to Darkstar `/finngen/romopapi/ancestors`
  - `POST /api/v1/finngen/code-explorer/report` → dispatches async run (returns `run_id`), client polls via foundation's `GET /api/v1/finngen/runs/{id}`
- Cache wrapper around the sync proxies — Redis, keyed by `(source_key, concept_id, endpoint)`, TTL 1h. ROMOPAPI's own memoization is inside R; this is an additional Laravel-side cache to cut Darkstar round-trips for hot concepts.
- RBAC: new permission `finngen.code-explorer.view` (seeded into `viewer` and above)

### 1.4 Darkstar additions

- `darkstar/api/finngen/romopapi.R`:
  - `GET /finngen/romopapi/code-counts` — sync, wraps `ROMOPAPI::getCodeCounts(cdmHandler, conceptId)`
  - `GET /finngen/romopapi/relationships` — sync, wraps a thin helper that queries `concept_relationship`
  - `GET /finngen/romopapi/ancestors` — sync, wraps `concept_ancestor` query with direction switch
  - `POST /finngen/romopapi/report` — `@async`, wraps `ROMOPAPI::createReport(...)`, writes HTML to `runs/{run_id}/report.html`, returns artifact map when mirai task finishes
- All four endpoints build `CDMdbHandler` from the `source` payload (per §0.5) and call `ROMOPAPI::*` functions directly. Never `runApiServer()`.

### 1.5 Frontend

- New feature module: `frontend/src/features/code-explorer/`
  - `pages/CodeExplorerPage.tsx` — 2-pane layout: source + concept picker left, tabbed results right (Counts | Relationships | Hierarchy | Report)
  - `components/StratifiedCountsChart.tsx` — Recharts stacked bar; year × gender × age_decile axes swappable; node/descendant toggle
  - `components/RelationshipTable.tsx` — AgGrid or reactable-equivalent, existing patterns
  - `components/AncestorGraph.tsx` — renders Mermaid string from ROMOPAPI (`mermaid` package, sandboxed)
  - `components/ReportButton.tsx` — kicks off async run, shows progress from `useFinnGenRun(runId)`, offers download link when `status=succeeded`
  - `api.ts` — TanStack Query hooks: `useCodeCounts`, `useCodeRelationships`, `useCodeAncestors`, `useRequestCodeReport`
- Route: add `/finngen/explore` to `frontend/src/app/router.tsx`
- Navigation: new top-level item "Code Explorer" under the Research section (existing nav pattern)
- Joyride tour for first-time users (existing `react-joyride` pattern) — 4 steps covering picker, chart, relationships, report

### 1.6 Success criteria

1. A researcher can look up concept `317009` (asthma) on `synpuf` and see 10+ years of stratified counts, >100 related concepts, and a full ancestor tree within 3 seconds of clicking search.
2. Generating a ROMOPAPI HTML report completes in <60s for a common concept and is downloadable from the UI.
3. Cold-cache hit on Darkstar is <2s (warm mirai pool) — validated by Pest integration test.
4. Redis cache hit returns in <50ms.
5. Works across all 8 CDM sources (validated by cycling through all sources in the picker on a test account).

### 1.7 Risks / open questions (flag at brainstorm time)

- Mermaid rendering of large ancestor subtrees (>500 nodes) may hang the browser; need a max-depth control or server-side summarization
- `createReport` generates HTML that embeds Plotly charts — need to decide whether to serve as static file with signed URL or render inside an iframe with CSP
- `concept_relationship` can have 10k+ rows for common concepts; paginate or virtualize

---

## 2. Sub-Project 3 — Analysis Module Gallery

### 2.1 Why this one second

- Validates the full async analysis path: long-running mirai jobs, Horizon polling, DuckDB artifact production, RBAC on `analyses.run`
- Proves the pluggable-module pattern before we tackle cohort workbench (the workbench hands off to analysis modules, so their contract must be stable)
- Delivers complete standalone value: users can run CodeWAS against any two pre-existing cohorts (from Parthenon's existing `app.cohorts` table) without needing the new workbench

### 2.2 User outcome

From a new route `/finngen/analyses`, a researcher:
1. Sees a **gallery** of available analysis modules as cards: CodeWAS, timeCodeWAS, Cohort Overlaps, Cohort Demographics, GWAS (behind a feature flag; GWAS needs Regenie infrastructure, not in scope here)
2. Clicks a module → sees a **settings form** specific to that module (case/control cohort pickers, covariate selector, min cell count, etc.) + an **Execute** button
3. On execute → sees a **run detail page** with live progress; on completion, the **results viewer** for that module appears inline
4. Can return later via a **run history list** (`/finngen/analyses/runs`) — runs persist 90 days (or forever if pinned)

### 2.3 Module registry (replaces upstream `analysisModulesConfig.yml`)

Laravel-side DB table `app.finngen_analysis_modules` (seeded, not user-editable from UI):

| Column | Purpose |
|---|---|
| `key` | e.g. `co2.codewas` — matches `finngen_runs.analysis_type` |
| `label` | Display name |
| `description` | 1-paragraph explanation |
| `settings_schema` | JSON Schema for the settings form (consumed by RJSF or a custom renderer) |
| `default_settings` | JSON defaults |
| `darkstar_endpoint` | Path under Darkstar (e.g. `/finngen/co2/codewas`) |
| `result_schema` | JSON describing the DuckDB tables the module writes (table names + column lists) — consumed by the results viewer to know what to render |
| `result_component` | String key → React component registry (e.g. `CodeWASResults`, `OverlapsUpsetPlot`) |
| `enabled` | Feature flag |
| `min_role` | RBAC (default `researcher`) |

Seeder for the 4 in-scope modules (GWAS deferred); seeder runs in Sub-Project 3.

### 2.4 Settings form pattern

- JSON-Schema-driven via RJSF (`@rjsf/core` + `@rjsf/bootstrap-4` or the Parthenon-native form system — **check existing patterns** before committing to RJSF)
- Custom widgets for Parthenon concepts:
  - `CohortPicker` — searches `app.cohorts` filtered by source
  - `ConceptSetPicker` — searches `app.concept_sets`
  - `CovariateSelector` — FeatureExtraction covariate multi-select (~200 standard options, grouped by demographic/condition/procedure/drug/measurement)
  - `TemporalWindowBuilder` — replicates upstream `mod_fct_formTimeWindows_*` (start days, end days, multiple windows); used by timeCodeWAS
- Client-side validation against `settings_schema`; server-side validation in `FinnGenRunService::validate()`

### 2.5 Results viewer pattern

- **Results read DuckDB directly in the browser** via `@duckdb/duckdb-wasm` — pulled from the artifact signed-URL and attached as a read-only database
- Component registry in `frontend/src/features/finngen-analyses/components/results/`:
  - `CodeWASResults.tsx` — Manhattan plot + forest plot + filterable AgGrid of associations; filters on p-value, OR, min cell count
  - `TimeCodeWASResults.tsx` — same as CodeWAS × time windows; small multiples of Manhattan plots
  - `CohortOverlapsResults.tsx` — UpSet plot (via `@upsetjs/react`) + raw overlap matrix
  - `CohortDemographicsResults.tsx` — Parthenon's existing `DemographicsTable` + age pyramid + stratified summaries
- If a module's `result_component` is registered, render it; otherwise render a generic `GenericDuckDBViewer` that lists tables + row counts (fallback for debugging)

### 2.6 Backend additions

- `app/Http/Controllers/Api/V1/FinnGen/AnalysisModuleController.php`:
  - `GET /api/v1/finngen/analyses/modules` — list registry entries (filtered by user role)
  - `GET /api/v1/finngen/analyses/modules/{key}` — single module + settings_schema
  - (Dispatch + status use foundation's `/api/v1/finngen/runs/*` routes)
- `app/Services/FinnGen/AnalysisModuleRegistry.php` — in-memory cache of the DB table
- `app/Jobs/RunFinnGenAnalysisJob.php` — already created in foundation; extended here with analysis-specific param mapping if needed
- Seeder: `database/seeders/FinnGenAnalysisModuleSeeder.php`
- Migration: `create_finngen_analysis_modules_table`

### 2.7 Darkstar additions

- `darkstar/api/finngen/co2_analysis.R`:
  - `POST /finngen/co2/codewas` — `@async`, wraps `CO2AnalysisModules::execute_CodeWAS(exportFolder=runs/{id}, cohortTableHandler=..., analysisSettings=...)`. Writes `results.duckdb` + `log.txt` + summary JSON.
  - `POST /finngen/co2/time-codewas` — similar, wraps `execute_timeCodeWAS`
  - `POST /finngen/co2/overlaps` — wraps `execute_CohortOverlaps`
  - `POST /finngen/co2/demographics` — wraps `execute_CohortDemographics`
  - (GWAS deferred — needs Regenie, not just R)
- Each endpoint:
  1. Build `CohortTableHandler` from `source` payload
  2. Ensure caller-specified cohorts exist in `{cohortSchema}.cohort` — return 422 if not
  3. Spawn mirai task with `CO2AnalysisModules::execute_*` call
  4. Return `{ job_id, status: "running" }` immediately
- Extend `darkstar/api/jobs.R` polling to include a `progress` object if the `execute_*` function writes progress to a well-known file (define convention: `runs/{id}/progress.json`)

### 2.8 Success criteria

1. CodeWAS on SynPUF (2.3M rows) completes in <15 minutes for a 5k-patient case cohort vs 50k-patient control cohort.
2. Results DuckDB loads in the browser in <5s and renders Manhattan plot for 10k+ associations without frame drops.
3. Cancelling a running CodeWAS kills the mirai task within 10s (validated by inspecting mirai worker state).
4. Run history list loads in <500ms for 100+ historical runs.
5. All four modules validated with Pest + Vitest integration tests against a small test cohort.
6. 80%+ test coverage across `AnalysisModuleRegistry`, `AnalysisModuleController`, settings schema validation.

### 2.9 Risks / open questions

- DuckDB-wasm memory footprint for 50MB+ result files — may need to read tables on demand rather than materializing the whole DB in memory
- Covariate selector UX for ~200 options — tree picker vs. search-based; check upstream `mod_fct_covariateSelector_ui` for ideas
- Progress reporting convention — `execute_*` functions don't emit progress natively; either wrap them with a progress-callback shim in R or accept "status: running + elapsed time" only
- GWAS deferred until we have a Regenie container. Open question whether Regenie runs in Darkstar, a sidecar, or externally.
- Cancelling a mirai task is officially supported but fragile in practice — test this early in SP1

---

## 3. Sub-Project 4 — Cohort Workbench

### 3.1 Why this one last

- Hardest UX: stateful multi-step workbench, drag-and-drop operation builder, matching UI, Atlas import
- Depends on both foundation (runs, artifacts) AND analysis modules (the workbench hands off to them)
- We need ~3 months of experience with the foundation before designing this; premature design = more throwaway work

### 3.2 User outcome

A researcher opens `/finngen/workbench` and sees a **multi-step workbench** that replaces the current `CohortOperationPanel` + `CodeWASRunner` mess:

1. **Step 1 — Select source.** Source picker (one-shot per session)
2. **Step 2 — Import cohorts.** Three tabs:
   - **From Parthenon** — search/select from `app.cohorts` (the normal flow)
   - **From Atlas** — connect to an external Atlas WebAPI via `ROhdsiWebApi`, browse/import cohort definitions
   - **From file** — upload JSON cohort definition(s) or CSV (person_id, cohort_start_date, cohort_end_date)
3. **Step 3 — Operate.** Drag-and-drop operation builder showing imported cohorts as blocks; user composes operations (UNION, INTERSECT, MINUS) with grouping; preview row counts at each step
4. **Step 4 — Match (optional).** Pick primary + comparator cohort(s), set ratio (1:1, 1:N), matching covariates (age/sex/index date/custom), show post-match diagnostics (SMD)
5. **Step 5 — Materialize.** Name the final cohort(s), choose destination (Parthenon's `app.cohorts` registry vs. temp), save. `cohort_definition_set` is generated into `{cohortSchema}.cohort` via `CohortGenerator::generateCohortSet` (through HadesExtras wrapper)
6. **Step 6 — Handoff.** Button "Analyze this cohort" → jumps to Analysis Module Gallery (SP3) with cohort pre-filled

### 3.3 State model

Workbench session state lives in **Laravel** (not Zustand-only), so it survives refresh and can be named/resumed:

- New table `app.finngen_workbench_sessions`:
  - `id`, `user_id`, `source_key`, `name` (user-editable), `state` (JSON: step, imported cohorts, operation tree, match config), `last_accessed_at`, `pinned`, timestamps
- Autosave every 5s via a `useAutosave` hook → `PUT /api/v1/finngen/workbench/sessions/{id}`
- Zustand store for in-flight UI state; DB is source of truth on page load

### 3.4 Drag-and-drop operation builder

Upstream CO2 uses `shinyjqui::orderInput()` + a text expression. We do **visual block-based**:

- Each imported cohort → a block with name + row count
- Drag blocks into operation groups (wrapped in UNION/INTERSECT/MINUS containers, nestable)
- Operation tree serializes to the same operation string HadesExtras expects (`"(1 UNION 2) MINUS 3"`) — HadesExtras does the SQL compilation
- Row count preview at each node via `POST /api/v1/finngen/workbench/preview-counts` (async if tree is deep; sync if shallow) — calls `HadesExtras` helper that runs the SQL as a dry-run or `EXPLAIN ANALYZE`-style count
- Library: `@dnd-kit/core` (already in Parthenon? check; otherwise add)

### 3.5 Matching UI

Replicates `mod_matchCohorts_*.R`:

- Primary cohort + 1-N comparator cohorts
- Matching ratio (1:1 default, up to 1:10)
- Matching covariates (age ± N years, sex exact, index date ± N days, custom CDM covariates via a selector)
- Exclusions (exclude subjects present in both)
- After matching: show SMD table, cohort size deltas, attrition waterfall
- Backend call: `POST /api/v1/finngen/workbench/match` → async run → writes matched cohort(s) to `{cohortSchema}.cohort` with new cohort_definition_ids

### 3.6 Atlas import

- Laravel-side `AtlasWebApiClient` service (new)
- Connection config: URL + auth (basic/bearer) stored encrypted in `app.atlas_connections` (new table, user-scoped)
- `GET /api/v1/finngen/atlas/cohort-definitions?connection_id=X&q=Y` — proxy search
- `POST /api/v1/finngen/atlas/import` — pulls definition JSON, converts to Parthenon `app.cohorts` row, runs `generateCohortSet` to materialize
- Use `ROhdsiWebApi` from R or replicate its HTTP calls in PHP (the PHP path is preferred — fewer Darkstar round trips, Atlas WebAPI is just JSON)

### 3.7 Frontend structure

`frontend/src/features/finngen-workbench/`:
- `pages/WorkbenchPage.tsx` — 6-step stepper layout
- `pages/SessionsListPage.tsx` — saved sessions
- `components/steps/SelectSourceStep.tsx`
- `components/steps/ImportCohortsStep.tsx` (with 3 tabs)
- `components/steps/OperateStep.tsx` — hosts `OperationBuilder`
- `components/steps/MatchStep.tsx`
- `components/steps/MaterializeStep.tsx`
- `components/steps/HandoffStep.tsx`
- `components/OperationBuilder.tsx` — dnd-kit tree
- `components/MatchingConfigForm.tsx`
- `components/AtlasConnectionModal.tsx`
- `components/CohortCounterPreview.tsx` — live row count after each op node
- `stores/workbenchStore.ts` — Zustand + autosave hook
- `hooks/useWorkbenchSession.ts`
- `api.ts`

### 3.8 Backend additions

- `app/Http/Controllers/Api/V1/FinnGen/WorkbenchController.php` — CRUD for sessions + preview-counts + materialize + match
- `app/Http/Controllers/Api/V1/FinnGen/AtlasController.php` — Atlas proxy
- `app/Services/FinnGen/WorkbenchSessionService.php`
- `app/Services/FinnGen/AtlasWebApiClient.php`
- `app/Services/FinnGen/CohortOperationCompiler.php` — compiles React operation-tree JSON → upstream operation string
- Migrations: `create_finngen_workbench_sessions_table`, `create_atlas_connections_table`
- RBAC: `finngen.workbench.use`, `finngen.workbench.atlas-import`

### 3.9 Darkstar additions

- `darkstar/api/finngen/cohort_ops.R`:
  - `POST /finngen/cohort/generate` — `@async`, wraps `CohortGenerator::generateCohortSet` via HadesExtras `CohortTableHandler`
  - `POST /finngen/cohort/match` — `@async`, wraps `HadesExtras::CohortGenerator_MatchingSubsetOperator` + generation
  - `GET /finngen/cohort/preview-count` — sync, wraps a count query against the compiled operation SQL
  - `GET /finngen/cohort/overlap` — sync (used in the matching diagnostics panel)
  - `GET /finngen/cohort/demographics` — sync (quick summary; full demographics is an SP3 analysis)

### 3.10 Success criteria

1. A researcher can import 3 cohorts from `app.cohorts`, compose `(A UNION B) MINUS C`, preview counts at each step, materialize the result, and hand off to CodeWAS — all without leaving the workbench — in <2 minutes of clicks on warm data.
2. Session autosave survives browser refresh and kill/reopen within 5s of last edit.
3. Atlas import works against at least one external Atlas WebAPI instance (Ohdsi public or EPAM's demo).
4. Matching on a 1:2 ratio for a 5k-patient cohort completes in <3 minutes and produces valid SMDs.
5. Operation builder handles trees up to 10 nodes deep without lag on a 2020-era laptop.
6. End-to-end Playwright test: full 6-step flow green.
7. Zero references to the old `CohortOperationPanel.tsx` / `CodeWASRunner.tsx` remain in the codebase.

### 3.11 Risks / open questions

- Drag-and-drop visual complexity — may need iterative UX reviews; consider mocking 3 layouts before committing (offer Visual Companion at brainstorm time)
- Matching quality — upstream uses `CohortGenerator_MatchingSubsetOperator`; we should verify it produces the same SMDs our users expect (validate against an existing Atlas-generated matched cohort on SynPUF)
- Atlas auth variability — Atlas instances use different auth schemes (Windows/LDAP/OAuth); scope to basic+bearer in SP4, defer others
- Session state schema drift — operation tree JSON shape will evolve; add a `schema_version` column and a migration path
- `ROhdsiWebApi` vs PHP for Atlas calls — make this call at brainstorm time based on feature parity needs

---

## 4. Cross-cutting conventions to enforce across SPs 2-4

### 4.1 Route naming

All FinnGen API routes under `/api/v1/finngen/*`. Never under `/api/v1/study-agent/*` (that namespace is deprecated for FinnGen concerns).

### 4.2 Component library

- Charts — Recharts (existing Parthenon standard; Manhattan plot is just a scatter with custom Y scale)
- Tables — existing `DataTable` or AgGrid, per whichever pattern is dominant in the feature module neighboring each new one
- Forms — check existing form infrastructure (react-hook-form + zod likely) before introducing RJSF
- Modals — existing `Dialog` component
- Drag-and-drop — `@dnd-kit/core` (add if not present)
- Mermaid — `mermaid` (add)
- UpSet plots — `@upsetjs/react` (add)
- DuckDB in-browser — `@duckdb/duckdb-wasm` (add)

### 4.3 Testing

- **Backend:** Pest feature tests for every new controller endpoint; RBAC assertions for each route; integration tests against a Darkstar mock (use Laravel's HTTP fake)
- **Frontend:** Vitest unit tests for every component; TanStack Query hook tests via `QueryClient` fixture; Playwright E2E for the one critical flow per sub-project
- **R-side:** extend Darkstar's existing test harness; each new Plumber route gets one happy-path test against the Eunomia demo CDM (ships with Darkstar)
- Coverage target: 80% per project rule

### 4.4 Error handling

- R errors bubble up as `{ error: { class, message, stack, reproducer_params_path } }` in Plumber responses. Laravel's `FinnGenClient` maps these to structured exceptions (`FinnGenRExecutionException`). UI shows a user-friendly message + a "copy diagnostic bundle" button that packages params + stack for filing an issue.
- Transient Darkstar errors (503, connection refused) trigger Horizon's retry with exponential backoff (foundation-level)
- Validation errors → 422 with per-field messages (per existing Laravel patterns)

### 4.5 Telemetry

- Emit an `finngen.run.*` event family (`started`, `progressed`, `succeeded`, `failed`, `canceled`) into Parthenon's existing audit log → Loki
- Track wall-clock time per analysis type; surface to admins via an existing Horizon/ops dashboard (not in scope for SPs 2-4, but emit the data)

### 4.6 HIGHSEC compliance

Every new endpoint passes the HIGHSEC.spec.md §2 three-layer check (auth:sanctum + permission + controller-level ownership for per-user resources like workbench sessions). No unauthenticated paths to clinical data. Workbench sessions and runs are user-scoped with optional sharing via signed links only.

### 4.7 Cleanup obligations per SP

Each SP lands these deletions as part of its PR (i.e., no "cleanup later" tickets):

- SP2: deletes any orphaned `StudyAgent*` helpers that SP1 left (if any)
- SP3: deletes any `FinnGen*` frontend code not already deleted in SP1
- SP4: deletes `frontend/src/features/investigation/` FinnGen-related code, any remaining `features/workbench/*` code, any `CohortOperation*` artifacts. **End state: zero FinnGen code from before 2026-04-12 remains.**

---

## 5. Dependency graph

```
SP1: Runtime Foundation
  ├── SP2: Code Explorer         (depends on SP1; can ship independently)
  ├── SP3: Analysis Module Gallery (depends on SP1; can ship independently)
  └── SP4: Cohort Workbench       (depends on SP1; soft-depends on SP3 for handoff UX)
```

SP2 and SP3 can run in parallel after SP1. SP4 should come after SP3 so the handoff target exists; if timeline demands, SP4 can ship with a stub "Open in Analysis Gallery" that works as soon as SP3 lands.

---

## 6. Timeline shape (order-of-magnitude, not commitment)

- SP1 Runtime Foundation: ~2 weeks (most complexity is in the Laravel service layer and Darkstar package integration)
- SP2 Code Explorer: ~1-1.5 weeks (smallest UX, validates end-to-end)
- SP3 Analysis Module Gallery: ~2-3 weeks (four modules × settings form × results viewer)
- SP4 Cohort Workbench: ~3-4 weeks (hardest UX, requires Visual Companion at brainstorm)

**Total: ~8-11 weeks** for a full React port. Compressible if SP2/SP3 run in parallel.

---

## 7. Starting the next sub-project

Each SP starts with its own brainstorming session. Load order:

1. Read this handoff doc end-to-end
2. Read `2026-04-12-finngen-runtime-foundation-design.md` to confirm foundation contracts are real
3. Re-read the relevant upstream package's R source (SP2 → ROMOPAPI; SP3 → CO2AnalysisModules/R/execute_*.R; SP4 → CohortOperations2/R/mod_*.R)
4. Invoke `superpowers:brainstorming` with the SP title as the topic
5. The spec lives under `docs/superpowers/specs/YYYY-MM-DD-finngen-<sp-name>-design.md`

---

## 8. Glossary

- **Darkstar** — Parthenon's R runtime container (`parthenon-darkstar`, service `r-runtime`, port 8787). Plumber2 + mirai 3-daemon worker pool. HADES installed; HADES audit cron monthly.
- **mirai** — R async task queue; Darkstar uses 3 daemon workers backing all `@async` Plumber endpoints.
- **HadesExtras** — R6-based plumbing wrapping HADES packages; all cohort ops and demographics flow through it.
- **CDMdbHandler / CohortTableHandler** — HadesExtras R6 classes. CDMdbHandler = connection + schemas; CohortTableHandler extends it with cohort state.
- **CO2 / CohortOperations2** — upstream Shiny workbench (we do **not** install this; SP4 replaces it natively).
- **CO2AnalysisModules** — upstream Shiny analysis gallery; we install it for `execute_*` functions only.
- **ROMOPAPI** — upstream Plumber service for code counts (we don't run their server; we import and call functions from our own Plumber).
- **operation string** — HadesExtras' compact representation of set operations, e.g. `"(1 UNION 2) MINUS 3"`. The React operation tree compiles to this.
- **analysisModulesConfig.yml** — upstream CO2's module registry format. We replace it with the `app.finngen_analysis_modules` DB table.
