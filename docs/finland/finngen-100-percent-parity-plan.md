# FINNGEN 100% Parity Plan

## Purpose

This document defines the plan to take the four FINNGEN-derived Workbench tools in Parthenon from their current high-parity state to functional, workflow, and UX parity with the original applications:

- `ROMOPAPI`
- `HADES Extras`
- `CohortOperations2`
- `CO2AnalysisModules`

This is a completion plan, not an initial backlog. The Workbench shell, persistence, replay, export, comparison, and most visualization families already exist. The remaining work is about replacing approximations with upstream-backed execution semantics, filling workflow gaps, and preserving the core operator experience.

## Current Approximate State

Rough parity at the time of writing (initial):

- `ROMOPAPI`: `87%`
- `HADES Extras`: `87%`
- `CohortOperations2`: `82%`
- `CO2AnalysisModules`: `88%`

Updated estimates (2026-03-16) after parity closure work:

- `ROMOPAPI`: `96%` — real CDM code counts, stratified counts, dynamic reports, cache lifecycle, R package wiring
- `HADES Extras`: `95%` — real cohort table lifecycle queries, YAML validation, connection validation, R package wiring
- `CohortOperations2`: `94%` — real matching samples, CohortOverlapService integration, drag/drop reordering, file import
- `CO2AnalysisModules`: `95%` — result validation wired, timeCodeWAS/GWAS parameters, CDM-backed metrics, R package wiring
- Cross-tool: `96%` — ROMOPAPI→HADES→CohortOps→CO2 handoff chain complete, artifact downloads functional, run replay/export/compare consistent
- Acceptance tests: 28-test matrix documented in `finngen-acceptance-test-matrix.md`

What is already materially complete:

- Workbench route and source-aware shell
- runtime diagnostics and adapter boundaries
- persisted runs, replay, export, comparison
- plausibility/sample evidence panels
- source-aware visualizations for all four tools
- Atlas import execution path
- cohort-table summary path
- YAML/config round-trip for HADES
- API-style execution controls for ROMOPAPI
- CO2 module-family branches for `CodeWAS`, `timeCodeWAS`, `GWAS`, demographics, utilization, burden, and stratified preview

## What 100% Means

Parity is only complete when all of the following are true:

1. The primary workflows supported by the original FINNGEN apps can be executed end to end from Parthenon.
2. The returned artifacts are materially derived from upstream-compatible logic, not only local framing.
3. The visual surfaces cover the same operator decisions as the original tools.
4. Failure, validation, logging, caching, and artifacts are inspectable without leaving the Workbench.
5. The tools work coherently together against the Acumenus OHDSI CDM.

## Remaining Gap Summary

### ROMOPAPI

What remains:

- true API-style request execution semantics rather than preview-only report framing
- deeper concept hierarchy traversal and count retrieval semantics
- cache-aware request lifecycle with clear refresh/bypass behavior
- report bundles that include request metadata, count exports, and graph/report artifacts as first-class outputs
- richer concept-graph and report artifact handling closer to `createMermaidGraphFromResults`, `createPlotFromResults`, and `createReport`

### HADES Extras

What remains:

- YAML import semantics beyond round-trip display
- config import/export behavior tied to actual package manifest changes
- cohort table lifecycle operations
- temporal covariate helper surfaces
- stronger connection/config validation parity
- standardized logging and helper outputs closer to `LogTibble`, `connectionHandlerFromList`, `CohortTableHandler`, and temporal FeatureExtraction helpers

### CohortOperations2

What remains:

- file import with FINNGEN semantics
- broader Atlas/WebAPI behavior beyond current import execution
- deeper cohort-table execution breadth
- stronger set-operation semantics grounded in upstream helper logic
- stronger matching semantics and diagnostics
- export artifact parity and WebAPI-oriented handoff
- drag/drop and multi-step cohort workbench behavior
- analysis-wrap parity into downstream CO2 module execution

### CO2AnalysisModules

What remains:

- true module-family execution semantics instead of high-fidelity previews
- stronger settings validation parity
- result validation before rendering
- overlaps parity closer to upstream overlap modules
- deeper phenotype scoring parity
- richer `timeCodeWAS` outputs
- real GWAS job orchestration and progression semantics
- downloadable module-family artifacts and comparison exports

## Strategic Principles

1. Do not add more generic panels first.
   Prioritize upstream behavior, artifacts, and workflow transitions.

2. Keep the current Parthenon UX shell.
   The user is reworking layout now; backend and contract work should not assume a fixed tab arrangement.

3. Prefer shared service primitives over one-off UI logic.
   The remaining 10-20% gaps are mostly orchestration, validation, artifact, and helper gaps.

4. Finish cross-tool workflow cohesion.
   `ROMOPAPI` -> `HADES Extras` -> `Cohort Ops` -> `CO2 Modules` must operate as one coherent study workflow.

5. Measure parity by acceptance criteria, not visual density.

## Completion Plan

### Phase A: ROMOPAPI to Full API Workflow

Goal:

- make ROMOPAPI behave like an API-oriented query and reporting tool, not only a schema preview surface

Work:

1. Add explicit request objects and response envelopes.
   - persist request method, cache mode, response format, report format, and query template as a structured API request
   - persist response metadata, artifact references, and query lifecycle status

2. Implement concept hierarchy and concept-count retrieval depth.
   - add explicit concept selection path
   - add hierarchy expansion depth controls tied to actual lineage output
   - produce count tables that vary by concept domain and request shape, not only by schema surface

3. Add report bundle parity.
   - emit markdown, HTML, manifest, count export, and graph/report artifact metadata as one report bundle
   - add request metadata and cache metadata into the report bundle

4. Add explicit cache lifecycle.
   - make `memoized_preview`, `refresh`, and `bypass` materially different in payload, runtime notes, and artifact metadata
   - persist cache-hit vs regenerated response markers

5. Expand persisted run review.
   - include request envelope, endpoint manifest, cache status, and bundle metadata in compare views

Acceptance criteria:

- a user can submit a ROMOPAPI-style request with explicit request method, cache mode, response format, and report format
- code counts and hierarchy output vary according to the request
- the report bundle is exportable and contains request metadata plus report artifacts
- cache mode is visible and persisted
- replaying a ROMOPAPI run preserves its API request envelope

Target parity after phase:

- `93-95%`

### Phase B: HADES Extras to Full Config and Helper Workflow

Goal:

- make HADES behave like a real helper/config/package workbench instead of only a render-and-manifest surface

Work:

1. Add YAML import semantics.
   - parse YAML into package config state
   - reflect parse errors and validation warnings explicitly
   - normalize YAML import into a canonical config export

2. Add connection/config validation parity.
   - explicit source/config readiness checks
   - show missing config inputs, source dialect constraints, and package-skeleton incompatibilities

3. Add cohort table lifecycle helpers.
   - create table, inspect table, validate columns, summarize content, and expose artifact implications

4. Add temporal covariate and helper support.
   - expose a small but real set of temporal covariate helper controls
   - feed them into config summary, manifest outputs, and lineage

5. Add structured helper logs.
   - persist structured HADES helper steps and validation outputs
   - show them in live and persisted runs

Acceptance criteria:

- YAML import materially changes package config, manifests, and config exports
- invalid YAML/config combinations are surfaced with structured validation
- cohort table lifecycle helpers are available and persisted
- temporal covariate helper configuration is represented in package outputs
- HADES helper logs are inspectable in live and replayed runs

Target parity after phase:

- `94-96%`

### Phase C: CohortOperations2 Workflow Completion

Goal:

- make Cohort Ops fully behave like a cohort workbench rather than a high-fidelity preview surface

Work:

1. Add file import semantics.
   - support file-backed import framing with validation and artifact preview
   - integrate into the existing operation builder modal flow

2. Deepen Atlas/WebAPI parity.
   - preserve imported cohort identity and mapping
   - expose import diagnostics, mapping status, and import artifacts
   - support explicit reuse vs re-import behavior

3. Expand cohort-table semantics.
   - table inspection, required-column diagnostics, and sampled cohort-definition views are already partial
   - add broader table-backed execution framing and artifact persistence

4. Strengthen operation semantics.
   - move operation evidence toward explicit subset semantics driven by selected cohort roles
   - preserve before/after counts, retained rows, excluded rows, and cohort-role evidence

5. Strengthen matching semantics.
   - explicit primary/comparator balance framing
   - better matching diagnostics, matched/excluded evidence, and persisted balance review

6. Add export artifact parity.
   - exported cohort package summary
   - manifest entries for downstream handoff
   - WebAPI-style export posture and replay

7. Add analysis-wrap parity.
   - downstream CO2 handoff should preserve export target, derived cohort identity, operation context, and matching context

Acceptance criteria:

- a user can import via Atlas/WebAPI, file, cohort table, or existing Parthenon cohorts
- operations materially affect outputs and exported cohort identity
- matching settings materially affect result evidence and persisted outputs
- exported artifacts are visible and replayable
- CO2 handoff preserves the real derived cohort context

Target parity after phase:

- `93-95%`

### Phase D: CO2AnalysisModules Upstream Execution Depth

Goal:

- make CO2 behave like a true multi-family analysis module suite rather than only an advanced preview and framing surface

Work:

1. Add module-family request builders.
   - each family should have a stable request contract with settings validation
   - parity families:
     - `CodeWAS`
     - `timeCodeWAS`
     - `CohortOverlaps`
     - `CohortDemographics`
     - `PhenotypeScoring`
     - `GWAS`

2. Add result validation.
   - explicit validation phase before render
   - persist warnings and failures in run payloads

3. Deepen overlap and demographics outputs.
   - overlap matrix is present; push closer to a true overlap-analysis surface
   - demographics should reflect subgroup framing and profile outputs more directly

4. Deepen phenotype scoring parity.
   - expose stronger family-specific scoring outputs and persisted result tables

5. Deepen `timeCodeWAS`.
   - windowed outputs should be materially tied to configured time windows
   - add persisted temporal summaries and comparison support

6. Add GWAS orchestration parity.
   - explicit job-like progression semantics
   - lead signal summary, method framing, trait metadata, and run lifecycle

7. Add family artifact exports.
   - family-specific manifests, result bundles, and run comparison exports

Acceptance criteria:

- each module family has distinct request, validation, result, and export semantics
- timeCodeWAS and GWAS no longer look like generic preview branches
- module-family outputs can be replayed and compared with preserved settings
- CO2 runs fully consume derived cohort context from Cohort Ops

Target parity after phase:

- `95-97%`

### Phase E: Cross-Tool Completion and Polish

Goal:

- close the last 3-5% by making the four tools operate as a single study workflow

Work:

1. Shared artifact model cleanup.
   - standardize manifest, bundle, log, and validation sections across all four tools

2. Run-inspector completion.
   - ensure every service exposes request envelope, response envelope, artifacts, logs, cache/runtime state, and export surfaces consistently

3. Cross-tool handoff completion.
   - ROMOPAPI-selected domain/query context can seed HADES and Cohort Ops
   - HADES config can seed cohort/table-related work
   - Cohort Ops export fully seeds CO2

4. Acceptance test matrix.
   - live source-backed checks on the Acumenus CDM
   - per-tool replay/export checks
   - per-tool compare checks

5. UX pass after layout rework.
   - once the user finishes reorganizing subpages, align the remaining modal, panel, and comparison flows to the new Workbench information architecture

Acceptance criteria:

- the four tools operate coherently as one study workflow
- replay/export/compare behavior is consistent
- the Acumenus CDM can be used across the entire chain
- no remaining critical workflow gaps from the original apps remain

Target parity after phase:

- all four tools at `100%` functional parity by the agreed acceptance standard

## Delivery Order

The recommended order is:

1. `ROMOPAPI` completion
2. `HADES Extras` completion
3. `Cohort Ops` completion
4. `CO2 Modules` completion
5. cross-tool completion pass

Why:

- `ROMOPAPI` and `HADES` are the cleanest remaining infrastructure/reporting gaps
- `Cohort Ops` is the central workflow hinge
- `CO2` depends on stronger cohort and artifact context for its final parity layer

## Concrete Next Tickets

These are the immediate next implementation tickets after the current ROMOPAPI slice:

1. ROMOPAPI request envelope persistence
2. ROMOPAPI cache-hit vs refresh behavior
3. ROMOPAPI report bundle manifest completion
4. HADES YAML parse/validation surface
5. HADES cohort table lifecycle actions
6. HADES helper-log persistence
7. Cohort Ops file import flow
8. Cohort Ops export artifact bundle
9. Cohort Ops stronger matching diagnostics
10. CO2 family validation layer
11. CO2 phenotype scoring depth
12. CO2 GWAS job-state surface

## Risks

1. Upstream semantics drift.
   The local parity estimate is only trustworthy if the Workbench contracts continue to map to the actual FINNGEN package intent.

2. UI churn during layout rework.
   The current plan avoids assuming a fixed page structure, but final UX alignment should happen after the new layout stabilizes.

3. Overcounting parity from visualization density.
   A page can look rich while still missing workflow-critical semantics.

4. Replay/export inconsistency.
   Each new field added to live runs must also be stored, replayed, compared, and exported.

## Definition of Done

The FINNGEN parity effort is complete only when:

- each tool meets its phase acceptance criteria
- replay/export/compare remain stable
- the Acumenus CDM path is verified for all four
- the remaining gap list is empty or explicitly accepted as out of scope
- the Workbench layout reorganization is reconciled with the completed flows
