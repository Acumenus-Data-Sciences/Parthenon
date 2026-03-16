# FINNGEN Parity Gap Analysis And Implementation Backlog

## Purpose

This document defines the parity target for bringing the four FINNGEN components into Parthenon:

- `CohortOperations2`
- `CO2AnalysisModules`
- `HadesExtras`
- `ROMOPAPI`

It is intended to be the working implementation backlog once the FINNGEN runner infrastructure is stable enough to support true upstream execution.

The goal is not a thin wrapper. The goal is functional and UX parity inside Parthenon:

- real upstream-backed execution where appropriate
- preservation of workflow semantics
- preservation of the visual analysis surfaces that make the FINNGEN tools usable
- safe integration into Parthenon's source, job, and artifact model

## Current State Summary

What exists now in Parthenon:

- `Workbench` route and FINNGEN tab shell
- source selection and runtime status panels
- adapter-first execution boundary for all four components
- repo-aware `finngen-runner` service
- compatibility-mode payloads that keep the UI testable before the upstream stack is fully available

What is not complete yet:

- full upstream R dependency/runtime installation
- true upstream-backed execution for the four FINNGEN components
- persisted FINNGEN jobs, artifacts, and reports
- complete reproduction of the FINNGEN module-specific visualization surfaces

## Parity Standard

Parthenon should be considered on par only when all of the following are true:

1. A user can configure and execute the core workflows each FINNGEN component supports.
2. The outputs are materially sourced from the upstream FINNGEN logic rather than only local approximations.
3. The essential visual workflows from the FINNGEN tools are represented in Parthenon in a way that is intuitive and native to the application.
4. The user can inspect logs, artifacts, validation failures, and execution state without dropping to raw infrastructure.
5. The integration is source-aware and works against the Acumenus OHDSI CDM.

## Component Gap Analysis

### CohortOperations2

Primary upstream purpose:

- cohort import, manipulation, matching, export, and handoff to analysis flows

Key upstream surface:

- `run_app`
- `mod_cohortWorkbench_*`
- `mod_importCohortsFromAtlas_*`
- `mod_importCohortsFromCohortsTable_*`
- file import modules
- `mod_dragAndDrop_*`
- `mod_matchCohorts_*`
- `mod_exportsCohorts_*`
- `mod_analysisWrap_*`
- HadesExtras-backed cohort operation and matching helpers

Current Parthenon coverage:

- source-aware cohort preview shell exists
- attrition/timeline visualization shell exists
- runtime diagnostics exist
- upstream execution parity is not complete

Gaps:

- Atlas/WebAPI import flow
- cohort-table import flow
- file import flow with FINNGEN semantics
- set operations and matching driven by upstream helpers
- export artifacts and WebAPI handoff
- analysis-wrap handoff into CO2 modules
- drag/drop workbench interaction model

Parity-critical visuals:

- cohort workbench layout
- import review panels
- operation/matching diff surfaces
- attrition/funnel and overlap visuals
- export summary and artifact manifest

### CO2AnalysisModules

Primary upstream purpose:

- configurable modular analysis execution with dedicated settings modules and result renderers

Key upstream surface:

- `execute_CodeWAS`
- `execute_timeCodeWAS`
- `execute_CohortOverlaps`
- `execute_CohortDemographics`
- `execute_GWAS`
- `execute_PhenotypeScoring`
- `assertAnalysisSettings_*`
- `checkResults_*`
- settings modules for each analysis family
- visualization modules for each analysis family

Current Parthenon coverage:

- module gallery shell
- preview metrics and placeholder visual families
- runtime diagnostics

Gaps:

- true upstream execution of each module family
- module-specific settings validation and payload generation
- result validation prior to render
- GWAS execution and job orchestration
- parity visual surfaces per module

Parity-critical visuals:

- CodeWAS results
- timeCodeWAS temporal visuals
- overlaps and UpSet-style views
- cohort demographics boards
- phenotype scoring surfaces
- GWAS result views and job progression

### HadesExtras

Primary upstream purpose:

- shared helper layer for connection handling, cohort table management, SQL and cohort operations, temporal covariates, summaries, and related utilities

Key upstream surface:

- `CDMdbHandler`
- `CohortTableHandler`
- `connectionHandlerFromList`
- `createCDMdbHandlerFromList`
- `createCohortTableHandlerFromList`
- `readAndParseYaml`
- `CohortGenerator_*`
- `FeatureExtraction_createTemporal*`
- `createMatchingSubset`
- `createOperationSubset`
- `operationStringToSQL`
- `reactable_connectionStatus`
- `rectable_cohortsSummary`
- `LogTibble`

Current Parthenon coverage:

- partial SQL render and source-backed preview paths
- runtime diagnostics
- no true shared upstream helper layer exposed end to end

Gaps:

- true HadesExtras-backed connection/config abstraction
- cohort table creation and lifecycle support
- temporal covariate helper support
- YAML config handling
- shared cohort summary rendering based on upstream output
- standardized logging and run-tibble support

Parity-critical visuals:

- connection/config inspection
- cohort summary tables
- operation SQL diff/lineage
- cohort table lifecycle view

### ROMOPAPI

Primary upstream purpose:

- API-oriented OMOP concept hierarchy and code count exploration with reports and graphs

Key upstream surface:

- `create_api`
- `runApiServer`
- `getAPIInfo`
- `getCodeCounts`
- `getConceptsWithCodeCounts`
- `createCodeCountsTables`
- `createStratifiedCodeCountsTable`
- `createMermaidGraphFromResults`
- `createPlotFromResults`
- `createReport`

Current Parthenon coverage:

- schema/query-plan style workbench panel
- compatibility-mode graph/profile output
- runtime diagnostics

Gaps:

- true plumber/API-backed execution
- code count retrieval and stratified result production
- hierarchy and concept traversal using ROMOPAPI logic
- report generation and artifact handling
- memoized/cached query surface

Parity-critical visuals:

- code count result tables
- stratified plots
- hierarchy graph / mermaid-style lineage
- report viewer/download surface

## Cross-Cutting Gaps

These apply across all four components:

- true upstream execution runtime
- source mapping from Parthenon sources to FINNGEN/Hades/ROMOPAPI configs
- persisted job model
- artifact storage and downloads
- structured logs and failure diagnostics
- route-level integration tests
- end-to-end UI rendering tests
- auth, access control, and explicit confirmation for any write side effects

## Implementation Backlog

### Phase 0: Runner Stabilization

Goal:

- make `finngen-runner` stable enough to support iterative parity work

Tickets:

1. Finish runner dependency installation strategy.
2. Persist installed R packages across restarts.
3. Split binary-installable packages from source-only packages.
4. Make bootstrap resumable and tolerant of partial progress.
5. Add explicit runner health and dependency status endpoint.

Acceptance criteria:

- `finngen-runner` starts reliably without OOM-killing the bootstrap
- dependency diagnostics are available via endpoint
- at least one FINNGEN component reports `upstream_ready: true`

Priority:

- Critical

### Phase 1: Shared Integration Foundations

Goal:

- establish common execution, jobs, artifacts, and source mapping

Tickets:

1. Define normalized FINNGEN run record in backend.
2. Persist runtime logs and artifact metadata.
3. Map Parthenon source selection to FINNGEN/Hades/ROMOPAPI config objects.
4. Add artifact retrieval/download endpoints.
5. Add structured adapter error model and UI presentation.

Acceptance criteria:

- every FINNGEN run has persisted status, logs, and artifact metadata
- selected Parthenon source is reproducibly translated into runner config
- Workbench can display prior runs and artifacts

Priority:

- Critical

### Phase 2: ROMOPAPI Upstream Parity

Goal:

- make ROMOPAPI the first truly upstream-backed component

Tickets:

1. Run `runApiServer` or equivalent upstream API surface in the runner.
2. Add concept/code-count request path from Parthenon to ROMOPAPI.
3. Normalize code count, concept, and stratified result payloads.
4. Add report generation artifact flow.
5. Add hierarchy graph rendering from upstream result structures.

Acceptance criteria:

- Workbench ROMOPAPI tab returns real `getCodeCounts` output
- concept hierarchy and stratified result views render from upstream payloads
- reports can be generated and downloaded

Priority:

- High

### Phase 3: HadesExtras Upstream Parity

Goal:

- expose HadesExtras as the shared backbone for cohort and analysis workflows

Tickets:

1. Implement upstream connection/config handlers.
2. Expose cohort table creation and summary helpers.
3. Expose temporal covariate setting helpers.
4. Add YAML config ingest and validation path.
5. Replace fallback SQL operation rendering with upstream helper outputs.

Acceptance criteria:

- HadesExtras tab returns upstream-backed outputs
- cohort summaries and operation SQL come from upstream helpers
- shared helper outputs are reused by other FINNGEN tabs

Priority:

- High

### Phase 4: CohortOperations2 Upstream Parity

Goal:

- reproduce the real cohort operations workflow in Parthenon

Tickets:

1. Add Atlas/WebAPI import flow.
2. Add file and cohort-table import flow.
3. Add upstream set-operations execution.
4. Add upstream cohort matching flow.
5. Add export flow with artifacts.
6. Add analysis-wrap handoff into CO2 modules.

Acceptance criteria:

- users can import, manipulate, match, inspect, and export cohorts through upstream-backed logic
- handoff into analyses is possible without manual payload reconstruction

Priority:

- High

### Phase 5: CO2AnalysisModules Upstream Parity

Goal:

- reproduce real FINNGEN module execution and module-specific visualizations

Tickets:

1. Implement `CodeWAS` execution and result rendering.
2. Implement `timeCodeWAS` execution and result rendering.
3. Implement `CohortOverlaps` execution and overlap visuals.
4. Implement `CohortDemographics` execution and cohort summary visuals.
5. Implement `PhenotypeScoring` execution and scoring visuals.
6. Implement `GWAS` execution path and job orchestration.
7. Mirror `assertAnalysisSettings_*` and `checkResults_*` in UI/backend flow.

Acceptance criteria:

- at least the major analysis families run through upstream logic
- each module has its own settings and result experience, not a generic renderer
- validation failures are surfaced before user sees broken results

Priority:

- High

### Phase 6: UX And Artifact Parity

Goal:

- make the integrated tools feel native to Parthenon without losing FINNGEN workflow power

Tickets:

1. Align every FINNGEN visual surface to Parthenon design language.
2. Preserve module-specific visuals rather than flattening them.
3. Add artifact/history drawer for every tool.
4. Add run comparison and result export surfaces.
5. Add onboarding/help affordances for each FINNGEN tab.

Acceptance criteria:

- visual parity exists at the task level
- users can move through each workbench without needing repo knowledge
- artifacts and history are inspectable from the same page

Priority:

- Medium

## Acceptance Criteria By Component

### CohortOperations2

Done when:

- import works from Atlas/WebAPI, files, and cohort tables
- operations and matching use upstream logic
- export artifacts are available
- analysis handoff is integrated

### CO2AnalysisModules

Done when:

- major analysis families run via upstream execution
- settings validation is upstream-aligned
- result renderers are module-specific and not generic placeholders

### HadesExtras

Done when:

- helper/config/summary operations come from upstream package behavior
- shared outputs are reused by the other FINNGEN tabs

### ROMOPAPI

Done when:

- real code counts and hierarchy outputs flow from ROMOPAPI
- report and graph generation are upstream-backed

## Recommended Execution Order

1. Stabilize `finngen-runner`.
2. Finish shared integration foundations.
3. Make `ROMOPAPI` fully upstream-backed.
4. Make `HadesExtras` fully upstream-backed.
5. Use HadesExtras outputs to unlock `CohortOperations2`.
6. Finish `CO2AnalysisModules` module-by-module.
7. Close remaining UX and artifact parity gaps.

## Risk Notes

- The largest technical risk is still runtime dependency weight in the FINNGEN runner.
- The largest product risk is flattening the FINNGEN tools into generic charts and forms.
- The largest integration risk is source/config translation between Parthenon and the FINNGEN runtime assumptions.

## Definition Of Done

The FINNGEN port should be considered complete only when:

- the four tools execute against Acumenus through upstream-backed logic
- the major FINNGEN workflows are preserved
- the distinctive visual result surfaces are present inside Parthenon
- runs, logs, and artifacts are persisted and inspectable
- test coverage exists across backend adapter mode and frontend workbench rendering
