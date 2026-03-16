# FINNGEN Workbench State And Parity

## Summary

This devlog captures where the FINNGEN integration stands in Parthenon as of 2026-03-15 after the latest Workbench and runner work.

The integration now has:

- live FINNGEN tabs in `Workbench`
- real upstream-ready runtime diagnostics
- persisted run history and run inspection
- replay/export actions for stored runs
- comparison of stored runs
- plausibility and sample-evidence panels driven by stored and live CDM-backed payloads

The integration does not yet have full parity with the original four FINNGEN applications. The largest remaining workflow gaps are in `CohortOperations2` and `CO2AnalysisModules`.

## What Is Live Now

### Cross-cutting

- `Workbench` route under the Sidebar `Tools` section
- tabs ordered by practical workflow:
  - `ROMOPAPI`
  - `HADES Extras`
  - `Cohort Ops`
  - `CO2 Modules`
- source selection against visible Parthenon CDM sources, including Acumenus
- runtime path diagnostics showing:
  - adapter mode
  - upstream readiness
  - compatibility mode
  - dependency issues
  - adapter/fallback state
- persisted FINNGEN runs in Laravel
- recent run history in Workbench
- run inspector with stored request/result/runtime/artifacts
- run comparison against another persisted run from the same tool/source
- replay and export actions for persisted runs
- plausibility/sample panels to make outputs look and feel CDM-grounded

### Backend

Implemented surfaces include:

- `GET /api/v1/study-agent/finngen/runs`
- `GET /api/v1/study-agent/finngen/runs/{runId}`
- `POST /api/v1/study-agent/finngen/runs/{runId}/replay`
- `GET /api/v1/study-agent/finngen/runs/{runId}/export`

Persisted FINNGEN runs store:

- service name
- source snapshot
- request payload
- result payload
- runtime payload
- artifact index
- submitted/completed timestamps

### Frontend

Workbench now supports:

- live execution panels per FINNGEN tool
- persisted inspection panels per FINNGEN tool
- stored artifact bundle export
- stored run replay
- stored run comparison

### Runner

`finngen-runner` is healthy and reports all four tools as upstream-ready. The Workbench runtime panel now exposes that status honestly.

## Per-Tool State

### ROMOPAPI

Current strengths:

- metadata summary
- schema graph
- hierarchy map
- schema density
- code counts
- stratified counts
- report artifact surfaces
- query plan and lineage
- persisted code-count/report inspection
- plausibility sample panel

Still missing for parity:

- fuller API-style execution surface
- richer report generation and delivery beyond JSON bundle export
- memoized/cached query controls
- deeper concept traversal parity

### HADES Extras

Current strengths:

- render summary
- connection context
- SQL diff lens
- config summary
- cohort summary
- operation lineage
- SQL preview
- artifact pipeline
- explain snapshot
- persisted lineage/artifact inspection
- plausibility sample panel

Still missing for parity:

- broader YAML/config workflow parity
- true downloadable package build outputs
- deeper cohort table lifecycle support
- more complete shared helper exposure

### Cohort Ops

Current strengths:

- compile summary
- attrition funnel
- criteria timeline
- import review
- matching review
- export summary
- compiled SQL
- sample rows
- persisted inspection for attrition/import/matching/export
- plausibility sample panel

Still missing for parity:

- Atlas/WebAPI import workflow parity
- cohort-table import parity
- file import parity
- drag/drop/reordering workbench semantics
- true set-operation and matching workflows driven by upstream helpers
- stronger handoff into CO2 workflows

### CO2 Modules

Current strengths:

- analysis summary
- forest plot
- module gallery
- heatmap
- subgroup balance
- phenotype scoring lens
- module validation
- overlap matrix
- time profile
- utilization trend
- top signals
- execution timeline
- persisted comparison and inspection surfaces
- plausibility sample panel

Still missing for parity:

- full upstream module-family execution
- true CodeWAS/timeCodeWAS/GWAS parity
- module-specific settings workflows
- deeper validation and job progression semantics

## Parity Estimate

Current parity estimate against the original FINNGEN apps:

- `ROMOPAPI`: about `70%`
- `HadesExtras`: about `65%`
- `CohortOperations2`: about `50%`
- `CO2AnalysisModules`: about `45%`

## What Is Effectively On Par

- visual Workbench shell quality
- source-aware execution framing
- runtime and readiness diagnostics
- persisted history and inspection
- replay/export of stored runs
- comparison of stored runs
- post-run artifact visibility
- plausibility/sample evidence presentation

## What Is Not Yet On Par

- true workflow depth for `CohortOperations2`
- true upstream module-family execution depth for `CO2AnalysisModules`
- richer artifact generation and delivery for `ROMOPAPI` and `HadesExtras`
- full import/export/handoff semantics across the cohort workflow

## Recommended Next Slice

The highest-value next slice is `Cohort Ops` workflow depth:

- make import mode a first-class request contract
- add Atlas/WebAPI and cohort-table framing inputs
- add matching strategy inputs
- add export target / handoff controls
- reflect those inputs in backend payloads, runner payloads, and persisted runs

That closes a real parity gap rather than adding another passive visualization layer.
