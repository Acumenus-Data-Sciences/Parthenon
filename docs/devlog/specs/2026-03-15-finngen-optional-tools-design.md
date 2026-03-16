# FINNGEN Optional Tools Integration Design

**Date:** 2026-03-15
**Status:** Proposed
**Scope:** StudyAgent MCP tools, backend proxy APIs, frontend tool UX

## Goal

Incorporate the functionality of the four FINNGEN projects as optional Parthenon tools without hard-coupling the platform to those dependencies:

- `FINNGEN/CohortOperations2`
- `FINNGEN/CO2AnalysisModules`
- `FINNGEN/HadesExtras`
- `FINNGEN/ROMOPAPI`

These should behave like power-user capabilities:

- disabled by default
- health-checked and registered only when configured
- visible to users only when available
- presented with rich, visual, workflow-first UX rather than raw endpoint forms

## Architectural Position

Use the existing StudyAgent MCP pattern as the integration seam.

Do **not** wire these projects directly into frontend pages or the Laravel monolith first.

Instead:

1. Add optional MCP tool modules in `study-agent/mcp_server/study_agent_mcp/tools/`
2. Add adapter clients under `study-agent/mcp_server/study_agent_mcp/adapters/finngen/`
3. Expose them through ACP `/services`
4. Add Laravel proxy endpoints only for frontend-facing orchestration and state
5. Build frontend workflows around typed tool sessions and visual result payloads

This keeps the dependency boundary explicit and lets Parthenon run cleanly even when FINNGEN tools are absent.

## Exact File / Folder Layout

### StudyAgent MCP

```text
study-agent/
  core/
    study_agent_core/
      models.py
      tools.py
      finngen_models.py                  # new
      finngen_tools.py                   # new deterministic result shapers

  mcp_server/
    study_agent_mcp/
      server.py
      tools/
        __init__.py
        finngen_cohort_operations.py     # new
        finngen_co2_analysis.py          # new
        finngen_hades_extras.py          # new
        finngen_romopapi.py              # new
      adapters/
        __init__.py                      # new
        finngen/
          __init__.py                    # new
          config.py                      # new
          base.py                        # new
          cohort_operations.py           # new
          co2_analysis.py                # new
          hades_extras.py                # new
          romopapi.py                    # new
          health.py                      # new

  docs/
    SERVICE_REGISTRY.yaml
    MCP_TOOL_AUTHORING.md
```

### Backend

```text
backend/
  app/
    Http/Controllers/Api/V1/
      FinnGenToolController.php          # new
      FinnGenSessionController.php       # new
    Services/FinnGen/
      FinnGenToolGateway.php             # new
      FinnGenSessionService.php          # new
      ToolAvailabilityService.php        # new
    Models/App/
      FinnGenToolSession.php             # new
  database/
    migrations/
      *_create_finngen_tool_sessions_table.php
  routes/
    api.php
```

### Frontend

```text
frontend/src/features/finngen/
  api/
    finngenApi.ts                        # new
  hooks/
    useFinnGenServices.ts                # new
    useFinnGenToolSession.ts             # new
    useFinnGenToolRun.ts                 # new
  pages/
    FinnGenToolsPage.tsx                 # new
    FinnGenToolDetailPage.tsx            # new
  components/
    catalog/
      FinnGenToolCatalog.tsx             # new
      FinnGenServiceBadge.tsx            # new
    cohort-operations/
      CohortOperationsWorkbench.tsx      # new
      CohortFlowGraph.tsx                # new
      CohortOperationTimeline.tsx        # new
      CohortDiagnosticsPanel.tsx         # new
    co2-analysis/
      AnalysisModulesWorkbench.tsx       # new
      AnalysisModuleGallery.tsx          # new
      ModuleRunSummary.tsx               # new
      OutcomeForestPlot.tsx              # new
      AttritionFunnel.tsx                # new
      CovariateHeatmap.tsx               # new
    hades-extras/
      HadesExtrasWorkbench.tsx           # new
      PackageBuilderFlow.tsx             # new
      SqlTranslationDiff.tsx             # new
      ExecutionArtifactPanel.tsx         # new
    romopapi/
      RomopWorkbench.tsx                 # new
      QueryBuilderCanvas.tsx             # new
      SchemaExplorerTree.tsx             # new
      ResultTablePanel.tsx               # new
      QueryPlanPanel.tsx                 # new
      QueryLineageMap.tsx                # new
  types/
    finngen.ts                           # new
```

## Tool Registration Model

Today `study-agent/mcp_server/study_agent_mcp/tools/__init__.py` uses a static `TOOL_MODULES` list.

Change it to a conditional manifest builder:

- always register existing core tools
- append FINNGEN modules only if enabled and healthy

Example env flags:

```text
FINNGEN_COHORT_OPERATIONS_ENABLED=1
FINNGEN_CO2_ANALYSIS_ENABLED=1
FINNGEN_HADES_EXTRAS_ENABLED=1
FINNGEN_ROMOPAPI_ENABLED=1

FINNGEN_COHORT_OPERATIONS_URL=...
FINNGEN_CO2_ANALYSIS_URL=...
FINNGEN_HADES_EXTRAS_URL=...
FINNGEN_ROMOPAPI_URL=...
```

Registration rule:

- env enabled
- adapter config valid
- health probe passes

If any condition fails:

- tool not registered in MCP
- service marked unavailable in ACP `/services`
- frontend shows informational disabled state, not a broken route

## First Tool Module Per Project

Expose one coarse-grained read/plan capability first for each integration.

### 1. CohortOperations2

Tool module:
- `finngen_cohort_operations.py`

First tool:
- `finngen_cohort_operations_inspect`

Purpose:
- accept a cohort definition or cohort operation plan
- return normalized cohort flow metadata, operation graph, attrition stats, and diagnostics summary

Why first:
- lowest write risk
- immediately useful for visual UX
- maps cleanly onto graph/timeline/funnel views

### 2. CO2AnalysisModules

Tool module:
- `finngen_co2_analysis.py`

First tool:
- `finngen_co2_module_catalog`

Purpose:
- list available analysis modules, input contracts, outputs, and visualization hints

Second tool after that:
- `finngen_co2_run_module`

Why first:
- lets frontend render a rich gallery before execution support

### 3. HadesExtras

Tool module:
- `finngen_hades_extras.py`

First tool:
- `finngen_hades_sql_preview`

Purpose:
- run translation/render/package-preview workflows and return structured diff artifacts

Why first:
- matches current Parthenon strengths around SQL rendering
- provides strong UX value with low operational risk

### 4. ROMOPAPI

Tool module:
- `finngen_romopapi.py`

First tool:
- `finngen_romop_schema_explorer`

Purpose:
- return OMOP schema metadata, vocab links, supported query domains, and queryable entities

Second tool after that:
- `finngen_romop_query_preview`

Why first:
- enables a great exploratory UI before enabling real query execution

## Core Models to Add

Add typed request/response contracts in:
- `study-agent/core/study_agent_core/finngen_models.py`

Minimum first-pass models:

- `FinnGenServiceStatus`
- `FinnGenToolDescriptor`
- `FinnGenCohortOperationsInspectInput`
- `FinnGenCohortOperationsInspectOutput`
- `FinnGenCo2ModuleCatalogInput`
- `FinnGenCo2ModuleCatalogOutput`
- `FinnGenHadesSqlPreviewInput`
- `FinnGenHadesSqlPreviewOutput`
- `FinnGenRomopSchemaExplorerInput`
- `FinnGenRomopSchemaExplorerOutput`

Keep core deterministic:

- output shaping
- validation
- visualization hints
- no network calls

Keep adapters impure:

- HTTP calls
- CLI/R subprocess calls
- remote repository compatibility handling

## ACP / Services Exposure

Add these entries to `study-agent/docs/SERVICE_REGISTRY.yaml`:

- `finngen_cohort_operations`
- `finngen_co2_analysis`
- `finngen_hades_extras`
- `finngen_romopapi`

Each should declare:

- `endpoint`
- `mcp_tools`
- `input`
- `output`
- `validation`
- `ui_hints`

Add `ui_hints` for frontend rendering:

- `recommended_layout`
- `default_visualizations`
- `supports_execution`
- `supports_read_only_preview`
- `result_kinds`

## Frontend UX Requirements

The frontend should preserve the stronger visual workflows seen in those repos rather than flattening everything into forms and tables.

### Common UX Frame

Build a dedicated `FinnGenToolsPage` with:

- service cards for all four integrations
- availability badges: `Available`, `Configured`, `Missing dependency`, `Preview only`
- visual previews per tool type
- “why unavailable” diagnostics
- deep links to each workbench

### CohortOperations2 UX

Primary visualizations:

- cohort operation DAG / flow graph
- attrition funnel
- time-window timeline
- diagnostics panel with lint + warnings
- cohort version diff

Use existing inspirations in Parthenon:

- cohort design editors
- jobs/status cards
- map/3D explorer pattern for inspectable overlays

### CO2AnalysisModules UX

Primary visualizations:

- module gallery with input/output cards
- run pipeline timeline
- module status swimlanes
- forest plots / coefficient plots / incidence trend charts
- covariate balance heatmap
- execution artifact browser

### HadesExtras UX

Primary visualizations:

- SQL before/after translation diff
- package build pipeline graph
- artifact tree
- generated file manifest
- validation checklist

### ROMOPAPI UX

Primary visualizations:

- schema explorer tree
- query builder canvas
- result table with profiling strip
- query lineage / dependency map
- query plan / cost panel

## API Shape Between Frontend and Backend

Backend should not expose raw FINNGEN repos directly.

Use backend endpoints like:

- `GET /api/v1/finngen/services`
- `GET /api/v1/finngen/tools`
- `POST /api/v1/finngen/tools/{tool}/run`
- `GET /api/v1/finngen/sessions/{id}`
- `GET /api/v1/finngen/sessions/{id}/artifacts`

Why:

- central auth and permission checks
- stable frontend contract
- session persistence for long-running tools
- artifact caching
- audit trail

## Permissions

Add separate capability flags:

- `finngen.view`
- `finngen.run`
- `finngen.configure`

And tool-specific capability filters at runtime:

- read-only tools visible to researchers
- execution/package/build tools limited to advanced roles

## Delivery Plan

### Phase 1

- conditional MCP registration
- service registry entries
- `GET /finngen/services`
- frontend catalog page
- one read-only tool per FINNGEN project

### Phase 2

- persisted backend sessions
- artifact viewer
- first executable tool for `CO2AnalysisModules`
- first executable preview for `ROMOPAPI`

### Phase 3

- richer visual analytics
- package build + execution workflows
- user-saved presets
- provenance / reproducibility export

## Recommendation

Start with:

1. `finngen_cohort_operations_inspect`
2. `finngen_co2_module_catalog`
3. `finngen_hades_sql_preview`
4. `finngen_romop_schema_explorer`

That gives you all four integrations visible in-product quickly, keeps them optional, and creates the frontend scaffolding needed for the richer FINNGEN-style UX before adding heavier execution paths.
