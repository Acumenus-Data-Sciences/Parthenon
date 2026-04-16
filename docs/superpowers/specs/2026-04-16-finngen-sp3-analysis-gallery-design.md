# FinnGen SP3 — Analysis Module Gallery Design Spec

**Date:** 2026-04-16
**Status:** Approved
**Depends on:** SP1 (runtime foundation), SP2 (Code Explorer — plumber2 fixes, darkstar image)
**Handoff ref:** `docs/superpowers/specs/2026-04-12-finngen-workbench-subprojects-handoff.md` §2

---

## 1. Goal

Add a "FinnGen Analyses" sub-tab inside the Investigation Clinical domain where researchers can run 4 statistical analyses (CodeWAS, timeCodeWAS, Cohort Overlaps, Demographics) on pre-existing cohorts. Each module has a card in a gallery, a detail page with settings form, async dispatch via SP1's `FinnGenRunService`, and pre-rendered result visualizations.

## 2. Scope

### In scope
- Gallery UI: 4 module cards inside Clinical → "FinnGen Analyses" sub-tab
- Detail page per module: settings sidebar + results panel + recent runs
- Settings forms: RJSF (React JSON Schema Form) with 3 custom widgets (CohortPicker, CovariateSelector, TemporalWindowBuilder)
- Result viewers: CodeWAS Manhattan plot + signal table, timeCodeWAS tabbed Manhattans, Overlaps UpSet plot, Demographics age pyramid
- `display.json` emission from each Darkstar worker (pre-processed chart-ready data)
- `AnalysisModuleController`: module list + detail endpoints
- JSON Schema validation in `FinnGenAnalysisModuleRegistry::validateParams()`
- Seeder updates: `settings_schema`, `default_settings`, `result_schema`, `result_component` for all 4 modules
- Run History sub-tab (cross-module filterable table)
- Contract tests (Pest) + E2E (Playwright)

### Out of scope
- GWAS / Regenie (future SP)
- DuckDB-wasm browser queries (raw `.duckdb` artifact available as download)
- Module creation/editing UI (modules are seeder-managed)
- Forest plot for CodeWAS (data in display.json; UI deferred)

## 3. Architecture

```
Investigation → Clinical domain → sub-tabs:
  ├─ OHDSI Analyses (existing legacy gallery)
  ├─ FinnGen Analyses (SP3 — new)
  │    ├─ Gallery view (4 module cards)
  │    └─ Detail page per module:
  │        ├─ Settings sidebar (RJSF + custom widgets)
  │        ├─ Run button → FinnGenRunService::create()
  │        ├─ Progress bar (polls /finngen/runs/{id})
  │        └─ Results panel (display.json → charts)
  └─ Run History (SP3 — new)
       └─ Cross-module filterable run table
```

### Key decisions (from brainstorm)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | Where in Investigation UI? | Sub-tabs inside Clinical | Keeps domain count manageable; FinnGen analyses are clinical-domain adjacent |
| Q2 | Settings form approach? | Hybrid RJSF + custom widgets | Schema-driven extensibility with polished UX for complex inputs |
| Q3 | Results rendering? | Pre-processed display.json | Workers emit chart-ready JSON; no client-side DuckDB; raw .duckdb downloadable |
| Q4 | Cohort selection? | Investigation-scoped + "Browse all" toggle | Focused by default; expandable when needed |
| Q5 | Which modules? | All 4 (CodeWAS, timeCodeWAS, Overlaps, Demographics) | Gallery infrastructure is the bulk; result viewers are incremental |
| Q6 | User flow? | Gallery → Detail Page | Results (Manhattan plots) need full width; matches existing Clinical pattern |
| Q7 | Run history? | Both: detail page sidebar + dedicated history sub-tab | Contextual iteration + cross-module search |
| Q8 | Testing? | Contract tests + E2E | Catches real bugs (schema/shape); skip jsdom chart rendering |

## 4. UI Design

### 4.1 Clinical sub-tabs

The Clinical domain panel gains a tab bar at the top:

```
┌──────────────────┬─────────────────────┬──────────────┐
│ OHDSI Analyses   │ FinnGen Analyses ●  │ Run History   │
└──────────────────┴─────────────────────┴──────────────┘
```

Active tab is highlighted with a bottom border (same pattern as Code Explorer's 5 tabs). Default tab remains "OHDSI Analyses" to preserve existing behavior.

### 4.2 Gallery view

2×2 card grid when "FinnGen Analyses" is active:

```
┌─────────────────────┐  ┌─────────────────────┐
│ ◆ CodeWAS           │  │ ◆ timeCodeWAS        │
│ Phenome-wide assoc  │  │ Temporal CodeWAS      │
│ scan                │  │ by time window        │
│           3 runs ▸  │  │           0 runs ▸   │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ ◆ Cohort Overlaps   │  │ ◆ Demographics       │
│ UpSet intersection  │  │ Age/gender summary    │
│ analysis            │  │ for cohorts           │
│           1 run  ▸  │  │           5 runs ▸   │
└─────────────────────┘  └─────────────────────┘
```

Each card shows:
- Module icon + title + description (from `finngen_analysis_modules` table)
- User's run count for this module in the current source
- Click → navigate to detail page

### 4.3 Detail page layout

Two-column layout inside the Clinical panel area:

```
← Back to Gallery │ CodeWAS — Phenome-wide association scan
─────────────────────────────────────────────────────────
│ SETTINGS (320px)     │ RESULTS (flex)                  │
│                      │                                 │
│ Case Cohort          │ ┌─ Manhattan Plot ────────────┐ │
│ [🔍 Search...]       │ │                             │ │
│                      │ │  ·  ·    ·                  │ │
│ Control Cohort       │ │ · ·· · ·  · ·              │ │
│ [🔍 Search...]       │ │·····················────────│ │
│                      │ │ Domain 1 │ Domain 2 │ ...   │ │
│ Min Cell Count       │ └─────────────────────────────┘ │
│ [5          ]        │                                 │
│                      │ ┌─ Signal Table ──────────────┐ │
│ [▶ Run Analysis]     │ │ Concept │ p-val │ β │ N    │ │
│ [  Reset       ]     │ │ ─────── │ ───── │── │ ──── │ │
│                      │ │ ...     │ ...   │.. │ ...  │ │
│ ─── Recent Runs ──── │ └─────────────────────────────┘ │
│ #3 succeeded · 2m    │                                 │
│ #2 succeeded · 1h    │                                 │
│ #1 failed    · 3h    │                                 │
─────────────────────────────────────────────────────────
```

States of the results panel:
- **Empty:** "Configure settings and run an analysis to see results."
- **Running:** Progress bar + step label + percentage (from `progress.pct` / `progress.step`)
- **Succeeded:** Result viewer component for the module type
- **Failed:** Error banner with category + message (from `run.error`)

Clicking a run in "Recent Runs" loads that run's results into the results panel.

### 4.4 Run History sub-tab

Full-width table:

```
┌────────┬──────────┬──────────┬───────────┬──────────┬──────┐
│ Module │ Source   │ Status   │ Created   │ Duration │ Pin  │
├────────┼──────────┼──────────┼───────────┼──────────┼──────┤
│ CodeWAS│ PANCREAS │ ✓ success│ 2 min ago │ 45s      │ 📌   │
│ Demo   │ PANCREAS │ ✓ success│ 1 hr ago  │ 12s      │      │
│ CodeWAS│ SYNPUF   │ ✗ failed │ 3 hr ago  │ 2s       │      │
└────────┴──────────┴──────────┴───────────┴──────────┴──────┘
  Filter: [Module ▾] [Status ▾] [Source ▾]
```

Click row → navigates to that module's detail page with the selected run's results loaded.

## 5. Data Flow

### 5.1 Dispatch

1. Browser submits `POST /api/v1/finngen/runs` with `{analysis_type: "co2.codewas", source_key: "PANCREAS", params: {...}}`
2. `FinnGenAnalysisModuleRegistry::validateParams()` validates `params` against the module's `settings_schema` using `opis/json-schema`. Rejects with 422 + structured error on validation failure.
3. `FinnGenRunService::create()` creates `finngen_runs` row + dispatches `RunFinnGenAnalysisJob` on the `finngen` Horizon queue.
4. Job dispatches to Darkstar via `POST /finngen/co2/codewas` (existing SP1 route).
5. Darkstar callr subprocess runs `finngen_co2_codewas_execute()`, writes `progress.json` → `results.duckdb` → `display.json` → `summary.json`.
6. Job polls Darkstar `/jobs/status/{id}`, updates `finngen_runs.progress`. On terminal state, extracts artifacts from `/opt/finngen-artifacts/runs/{run_id}/`.

### 5.2 display.json shapes

Each Darkstar worker emits a `display.json` alongside existing artifacts. Shape per module:

**CodeWAS (`co2.codewas`):**
```json
{
  "signals": [
    {
      "concept_id": 201826,
      "concept_name": "Type 2 diabetes mellitus",
      "domain_id": "Condition",
      "p_value": 0.00001,
      "beta": 1.42,
      "se": 0.31,
      "n_cases": 150,
      "n_controls": 300
    }
  ],
  "thresholds": {
    "bonferroni": 0.000025,
    "suggestive": 0.0001
  },
  "summary": {
    "total_codes_tested": 2000,
    "significant_count": 42
  }
}
```

**timeCodeWAS (`co2.time_codewas`):**
```json
{
  "windows": [
    {
      "start_day": -365,
      "end_day": -1,
      "signals": [{"concept_id": ..., "p_value": ..., "beta": ...}]
    },
    {
      "start_day": 0,
      "end_day": 30,
      "signals": [...]
    }
  ],
  "summary": {
    "window_count": 2,
    "total_significant": 67
  }
}
```

**Cohort Overlaps (`co2.overlaps`):**
```json
{
  "sets": [
    {"cohort_id": 1, "cohort_name": "T2DM Cases", "size": 1500},
    {"cohort_id": 2, "cohort_name": "Pancreatic Cancer", "size": 361}
  ],
  "intersections": [
    {"members": [1, 2], "size": 45, "degree": 2}
  ],
  "matrix": [[1500, 45], [45, 361]],
  "summary": {
    "max_overlap_pct": 12.5
  }
}
```

**Demographics (`co2.demographics`):**
```json
{
  "cohorts": [
    {
      "cohort_id": 1,
      "cohort_name": "T2DM Cases",
      "n": 1500,
      "age_histogram": [
        {"decile": 3, "male": 12, "female": 18},
        {"decile": 4, "male": 45, "female": 52}
      ],
      "gender_counts": {"male": 680, "female": 820, "unknown": 0},
      "summary": {"mean_age": 58.3, "median_age": 57}
    }
  ]
}
```

### 5.3 Settings schemas

Each module's `settings_schema` is a JSON Schema document stored in `finngen_analysis_modules.settings_schema`. RJSF renders the form from it. Custom widgets are registered via `uiSchema` overrides.

**CodeWAS settings_schema (abbreviated):**
```json
{
  "type": "object",
  "required": ["case_cohort_id", "control_cohort_id"],
  "properties": {
    "case_cohort_id": {
      "type": "integer",
      "title": "Case Cohort",
      "ui:widget": "CohortPicker"
    },
    "control_cohort_id": {
      "type": "integer",
      "title": "Control Cohort",
      "ui:widget": "CohortPicker"
    },
    "min_cell_count": {
      "type": "integer",
      "title": "Minimum Cell Count",
      "default": 5,
      "minimum": 1,
      "maximum": 100
    }
  }
}
```

**timeCodeWAS** — extends CodeWAS schema + adds:
```json
{
  "time_windows": {
    "type": "array",
    "title": "Time Windows",
    "ui:widget": "TemporalWindowBuilder",
    "items": {
      "type": "object",
      "properties": {
        "start_day": {"type": "integer"},
        "end_day": {"type": "integer"}
      }
    },
    "default": [
      {"start_day": -365, "end_day": -1},
      {"start_day": 0, "end_day": 30}
    ]
  }
}
```

**Overlaps** — requires 2+ cohort IDs:
```json
{
  "cohort_ids": {
    "type": "array",
    "title": "Cohorts to Compare",
    "ui:widget": "CohortPicker",
    "items": {"type": "integer"},
    "minItems": 2,
    "maxItems": 10
  }
}
```

**Demographics** — requires 1+ cohort IDs:
```json
{
  "cohort_ids": {
    "type": "array",
    "title": "Cohorts",
    "ui:widget": "CohortPicker",
    "items": {"type": "integer"},
    "minItems": 1,
    "maxItems": 20
  }
}
```

## 6. API Endpoints

### 6.1 New endpoints

| Method | Path | Middleware | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/finngen/analyses/modules` | `auth:sanctum`, `permission:finngen.code-explorer.view` | List enabled modules filtered by user role |
| `GET` | `/api/v1/finngen/analyses/modules/{key}` | `auth:sanctum`, `permission:finngen.code-explorer.view` | Single module + full settings_schema |

### 6.2 Existing endpoints reused (SP1, unchanged)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/finngen/runs` | Dispatch analysis — now validates params vs settings_schema |
| `GET` | `/api/v1/finngen/runs` | List runs (filter by analysis_type, status, source_key) |
| `GET` | `/api/v1/finngen/runs/{id}` | Status + progress + artifacts |
| `GET` | `/api/v1/finngen/runs/{id}/artifacts/{key}` | Signed-URL artifact streaming |
| `POST` | `/api/v1/finngen/runs/{id}/cancel` | Cancel |
| `POST/DELETE` | `/api/v1/finngen/runs/{id}/pin` | Pin toggle |

### 6.3 Permissions

No new permissions. Reuse:
- `finngen.code-explorer.view` — browse modules, view results (viewer, researcher, admin, super-admin)
- `analyses.run` — dispatch runs (researcher, admin, super-admin)

### 6.4 New PHP dependency

`opis/json-schema` — JSON Schema validation for settings params. Install via `composer require opis/json-schema`.

## 7. Result Viewers

### 7.1 CodeWAS (`CodeWASResults.tsx`)

- **Manhattan plot:** Recharts ScatterChart. X = concepts grouped/colored by domain_id. Y = -log10(p_value). Horizontal threshold lines for Bonferroni + suggestive. Hover tooltip: concept name, p-value, beta, N.
- **Signal table:** Sortable columns: concept_name, domain_id, p_value, beta, se, n_cases, n_controls. Default sort: p_value ascending. "Export CSV" button.

### 7.2 timeCodeWAS (`TimeCodeWASResults.tsx`)

- **Tabbed Manhattan plots:** Tab bar with one tab per time window (label: "Day {start} to {end}"). Each tab renders the same Manhattan component as CodeWAS.
- **Summary bar:** "{N} windows · {M} total significant signals"

### 7.3 Cohort Overlaps (`OverlapsResults.tsx`)

- **UpSet plot:** `@upsetjs/react`. Horizontal bars = set sizes, vertical bars = intersection sizes, dot matrix = membership.
- **Intersection table:** Member cohorts, intersection size, percentage of smallest member set.

### 7.4 Demographics (`DemographicsResults.tsx`)

- **Age pyramid:** Recharts horizontal BarChart. Left = male deciles, right = female. If multiple cohorts: grouped or stacked bars with legend.
- **Summary cards:** Per-cohort: N, mean age, median age, gender split (M/F/U percentages).

### 7.5 Fallback

`GenericResultViewer.tsx` — renders `display.json` as formatted JSON tree. Used for any module key not matched by the switch.

## 8. Testing

### 8.1 Backend (Pest) — ~8 tests

- `AnalysisModuleController`: list modules (4 returned), single module detail, role filtering (viewer sees modules, but can't run), 404 on unknown key
- `FinnGenAnalysisModuleRegistry::validateParams()`: valid params pass, invalid params reject with structured error listing violations, unknown module throws `FinnGenUnknownAnalysisTypeException`
- Seeder verification: all 4 CO2 modules + 2 ROMOPAPI modules have non-null `settings_schema`

### 8.2 Darkstar (testthat) — 4 nightly tests

One per module: execute against Eunomia (fast, small), verify `display.json` exists in export folder with expected top-level keys. Nightly slow-lane gated behind `FINNGEN_PG_RW_PASSWORD`.

### 8.3 Frontend (Vitest) — ~4 contract tests

- `useAnalysisModules()` hook returns expected shape from mocked API
- RJSF settings form renders from CodeWAS schema without crash
- `ResultViewerSwitch` maps `co2.codewas` → `CodeWASResults`, unknown → `GenericResultViewer`
- `CohortPicker` renders investigation cohorts by default

### 8.4 E2E (Playwright) — 1 spec, 3 tests

- Gallery loads with 4 cards inside Clinical → FinnGen Analyses tab
- Click CodeWAS card → detail page renders settings form with CohortPicker
- Dispatch run via API + poll terminal + verify `display` artifact exists in response

Gated behind source readiness (same as SP2).

## 9. File Structure

### Backend (new/modified)
```
backend/
  app/Http/Controllers/Api/V1/FinnGen/
    AnalysisModuleController.php          — NEW (2 endpoints)
  app/Services/FinnGen/
    FinnGenAnalysisModuleRegistry.php     — MODIFY (add JSON Schema validation)
  database/seeders/
    FinnGenAnalysisModuleSeeder.php       — MODIFY (add schemas for 4 modules)
  routes/api.php                          — MODIFY (add 2 module routes)
  tests/Feature/FinnGen/
    AnalysisModuleEndpointsTest.php       — NEW
  tests/Unit/FinnGen/
    SettingsSchemaValidationTest.php      — NEW
```

### Darkstar (modified)
```
darkstar/api/finngen/
  co2_analysis.R                         — MODIFY (add display.json emission to all 4 workers)
darkstar/tests/testthat/
  test-finngen-co2-display-json.R        — NEW (4 shape tests)
```

### Frontend (new)
```
frontend/src/features/finngen-analyses/
  index.ts
  types.ts
  api.ts                                 — TanStack hooks for modules + runs
  pages/
    AnalysisGalleryPage.tsx              — 2×2 card grid
    AnalysisDetailPage.tsx               — settings sidebar + results panel
  components/
    ModuleCard.tsx
    SettingsForm.tsx                      — RJSF wrapper + widget registration
    widgets/
      CohortPicker.tsx                   — searchable, investigation-scoped + browse-all
      CovariateSelector.tsx              — grouped checkboxes + presets
      TemporalWindowBuilder.tsx          — array of {start_day, end_day} pairs
    results/
      ResultViewerSwitch.tsx             — maps module key → viewer component
      CodeWASResults.tsx                 — Manhattan + signal table
      TimeCodeWASResults.tsx             — tabbed Manhattans
      OverlapsResults.tsx                — UpSet + intersection table
      DemographicsResults.tsx            — age pyramid + summary cards
      GenericResultViewer.tsx            — JSON tree fallback
    RunHistoryTable.tsx                  — cross-module filterable table
    RunProgressBar.tsx                   — step + percentage from progress field
  hooks/
    useAnalysisModules.ts
    useModuleRuns.ts
  __tests__/
    useAnalysisModules.test.tsx
    SettingsForm.test.tsx
    ResultViewerSwitch.test.tsx
    CohortPicker.test.tsx
frontend/src/features/investigation/
  components/clinical/
    ClinicalPanel.tsx                    — MODIFY (add sub-tab bar)
  types.ts                              — MODIFY (add ClinicalSubTab type if needed)
```

### Integration points
```
e2e/tests/
  finngen-analysis-gallery.spec.ts       — NEW
```

## 10. New dependencies

| Package | Purpose | Install |
|---|---|---|
| `opis/json-schema` | PHP JSON Schema validation | `composer require opis/json-schema` |
| `@rjsf/core` + `@rjsf/utils` + `@rjsf/validator-ajv8` | React JSON Schema Form | `npm install --legacy-peer-deps` |
| `@upsetjs/react` | UpSet plot for Cohort Overlaps | `npm install --legacy-peer-deps` |

Recharts already installed. ReactFlow already installed (SP2). TanStack Query already installed.

## 11. Rollout

### Deploy steps
1. `composer require opis/json-schema` in PHP container
2. `npm install` new frontend deps
3. Run seeders: `FinnGenAnalysisModuleSeeder --force` (populates schemas)
4. `./deploy.sh` (full)
5. Verify `GET /api/v1/finngen/analyses/modules` returns 4 modules with schemas
6. Browser: open Investigation → Clinical → FinnGen Analyses → click CodeWAS → configure → run

### Rollback
- Feature is additive (new sub-tab). Removing the sub-tab bar reverts to existing Clinical behavior.
- No migrations (schemas stored in seeder-managed rows, not schema changes).
- Frontend code-split via lazy import — removing the route removes the bundle.
