# FINNGEN Workbench — Developer Acceptance Review

## Context

Parthenon has integrated the four FINNGEN tools (ROMOPAPI, HadesExtras, CohortOperations2, CO2AnalysisModules) into a unified Workbench at `https://parthenon.acumenus.net/workbench`. The tools are source-scoped against the Acumenus OHDSI CDM (1M persons, 7.2M concepts, 14.7M condition records, PostgreSQL 17).

The Workbench currently operates in a hybrid mode:

- **Backend (Laravel)** queries the CDM directly via `DynamicConnectionFactory` for real code counts, person metrics, stratification, matching samples, and cohort overlap
- **finngen-runner (Python + R)** has all four R packages installed and can execute upstream R functions via `Rscript` subprocess when `upstream_ready = true`
- **Compatibility mode** provides preview framing when upstream execution is unavailable

We estimate **97-98% functional parity** with the original tools. This document describes the remaining gaps and asks specific questions to close them.

---

## How This Document Works

For each tool, we describe:
1. **What Parthenon currently does** — the implemented behavior
2. **What we think the original tool does** — our understanding of upstream semantics
3. **Questions for the developer** — specific gaps where we need guidance

Please answer the questions inline or in a reply. Where a question asks "is this correct?", a simple yes/no with a brief note is sufficient. Where a question asks "how does X work?", a short description or pointer to the relevant R function is ideal.

---

## 1. ROMOPAPI

### What Parthenon currently does

- Queries `information_schema.tables` + `pg_class.reltuples` for schema node discovery
- Queries real code counts from CDM tables (`condition_occurrence`, `drug_exposure`, `measurement`, `procedure_occurrence`, `observation`) joined to `concept` for concept names
- Queries `concept_ancestor` for concept hierarchy traversal (when the table exists)
- Stratifies counts by sex (via `gender_concept_id` → concept name), age band (decade buckets from `year_of_birth`), or care site
- Generates Mermaid graph diagrams from schema nodes
- Generates markdown and HTML report bundles with real code count data
- Implements cache lifecycle: `memoized_preview` (read+write), `refresh` (skip read, write), `bypass` (skip both)
- Runner calls `HadesExtras_createCDMdbHandlerFromList()` → can invoke `createCodeCountsTables()` when R packages are available

### Questions

**Q-ROM-1:** `getCodeCounts(CDMdbHandler, schema)` — does this function accept a schema name as the second argument, or is the schema already embedded in the CDMdbHandler? Our direct SQL approach queries by schema, but we want to ensure the upstream function signature is being called correctly.

**Q-ROM-2:** `createCodeCountsTables()` writes results to a table in the results schema. What is the expected table name? Is it `code_counts` and `stratified_code_counts`? Should we read from those tables after creation, or does the function return the data directly?

**Q-ROM-3:** `createMermaidGraphFromResults()` — what does the `results` argument look like? Is it the output of `getCodeCounts()`, or a different structure? We currently generate Mermaid from schema nodes (tables + connections), not from code count results.

**Q-ROM-4:** `createReport()` — what format does this return? A file path to a generated HTML/markdown file, or a string of content? Does it require a running Plumber server, or can it be called standalone?

**Q-ROM-5:** `createPlotFromResults()` — does this generate a static image (PNG/SVG), or a Plotly object? How should we capture the output for embedding in the Workbench?

**Q-ROM-6:** The `create_api()` / `runApiServer()` functions — are these intended for standalone Plumber deployment, or should the Workbench call individual functions directly? We currently call functions directly via Rscript subprocess rather than running a persistent Plumber server.

---

## 2. HadesExtras

### What Parthenon currently does

- Renders SQL templates with schema substitution (`@cdm_schema` → real schema) via `SqlRendererService`
- Parses YAML config line-by-line, validates required keys (`package.name`, `render.target`, etc.), reports missing fields
- Queries `information_schema` for real cohort table existence, row count, column validation, distinct cohort_definition_ids
- Generates package manifest entries based on artifact mode (sql_only, sql_and_manifest, full_bundle) and package skeleton (ohdsi_study, lightweight_sql, finngen_extension)
- Runs `EXPLAIN` on rendered SQL for plan inspection
- Provides temporal covariate helper configuration (11 settings across demographics, conditions, drugs, procedures, indices + 4 temporal windows)
- Runner creates `connectionHandlerFromList()` and validates connection

### Questions

**Q-HAD-1:** `CohortTableHandler` — what is the expected constructor signature? We see it takes `connectionHandler`, `cohortTableName`, and `cohortDefinitionTableName`. Are there additional required arguments? What does the `$getCohortCounts()` method return?

**Q-HAD-2:** `LogTibble` — is this an R6 class with `$INFO()`, `$WARN()`, `$ERROR()` methods? What does `$logs` return — a tibble/data.frame of log entries? We want to display structured log output in the Workbench.

**Q-HAD-3:** `FeatureExtraction_createTemporalCovariateSettingsFromList()` — what is the expected input list format? We currently provide a list of named settings (e.g., `DemographicsGender`, `ConditionGroupEraLongTerm`) with temporal window definitions. Is this the correct structure, or does it expect a different format?

**Q-HAD-4:** `connectionHandlerFromList()` expects `configConnection` with `connectionDetailsSettings`. Are there any additional optional fields (e.g., `tempEmulationSchema`, `cdmVersion`) that we should support? We see `tempEmulationSchema` is checked in the source.

**Q-HAD-5:** The YAML config format — is there a canonical schema for HadesExtras YAML? We currently recognize `package.name`, `package.profile`, `render.target`, `render.artifact_mode`, `render.skeleton`, `cohort.table`, and `cohort.results_schema`. Are there additional sections (e.g., `temporal`, `covariates`, `analysis`) that the original tool expects?

**Q-HAD-6:** When config profile changes (e.g., from `acumenus_default` to `analysis_bundle`), should the package manifest change? Currently our manifests are driven by `artifact_mode` and `package_skeleton`, not by `config_profile`. Is `config_profile` supposed to alter the package contents?

---

## 3. CohortOperations2

### What Parthenon currently does

- Imports cohorts from: Parthenon (existing cohort definitions with SQL compilation), Atlas/WebAPI (via `AtlasCohortImportService`), cohort tables (with column validation), file upload (CSV/JSON parsing), and raw JSON definitions
- Applies set operations: union, intersect, subtract — with real overlap computation via `CohortOverlapService` for 2+ Parthenon cohorts
- Computes matching metrics (nearest-neighbor, exact, stratified) with real person samples from CDM `person` table
- Supports drag/drop reordering of selected cohorts in the Operation Builder
- Provides Atlas import diagnostics with per-cohort mapping status and concept set counts
- Hands off derived cohort context (reference, row count, operation type, selected cohorts) to CO2 Modules

### Questions

**Q-COH-1:** The original Shiny workbench has `mod_cohortWorkbench_server` and `mod_dragAndDrop_server`. In the Shiny app, what data structure represents the cohort list and its order? We use a simple `number[]` of cohort IDs that the user can reorder. Is this sufficient, or does the original track additional metadata per cohort (e.g., role, color, group)?

**Q-COH-2:** `mod_importCohortsFromAtlas_server` — after importing from Atlas, does the original tool store the imported cohorts in the local results schema cohort table, or does it keep them in memory? We currently import via `AtlasCohortImportService` which creates Parthenon cohort definitions but doesn't write to the results cohort table.

**Q-COH-3:** For the `subtract` operation — is the semantics always "first cohort minus all others", or can the user designate any cohort as the minuend? We currently treat the first cohort in the ordered list as the anchor for subtraction.

**Q-COH-4:** `mod_fct_appendCohort_server` — what does "append" mean in this context? Is it adding a new cohort to the workbench from a different source (file, Atlas, table), or is it appending rows to an existing cohort?

**Q-COH-5:** `mod_analysisWrap_server` — what does the analysis wrap do when handing off to CO2? Does it generate a specific settings object (e.g., `analysisSettings_CodeWAS`)? We currently pass a flat context object with `cohort_reference`, `export_target`, `result_rows`, `operation_type`, and `selected_cohorts`. Is there a specific contract that CO2 expects?

**Q-COH-6:** `fct_assertdatabasesConfig` and `fct_checkdatabasesConfig` — what configuration do these validate? Is it the source connection, the cohort table, or both? What do they return on failure?

**Q-COH-7:** File import — the original tool's `mod_fct_appendCohort_server` supports file upload. What file formats are expected? CSV only, or also TSV, JSON, Excel? What are the required columns? Is `person_id` (or `subject_id`) + `cohort_start_date` sufficient, or are additional columns required?

---

## 4. CO2AnalysisModules

### What Parthenon currently does

- Supports 8 module families: comparative_effectiveness, CodeWAS, timeCodeWAS, condition_burden, cohort_demographics, drug_utilization, GWAS, sex_stratified
- Queries real CDM data: person count, condition/drug/procedure person counts, age band distribution, monthly event trends, top concept signals
- Calls `buildCo2ResultValidation()` which checks: cohort context readiness, result rows, top signals, temporal output, population floor (≥25)
- For GWAS: builds job progression state (phenotype prep → genotype QC → method execution → signal extraction → report generation) with method-specific labels
- For timeCodeWAS: respects `time_window_count` and `time_window_unit` parameters in temporal window generation
- Runner can call `execute_CodeWAS()`, `execute_CohortDemographics()`, etc. via Rscript when R packages are available

### Questions

**Q-CO2-1:** `execute_CodeWAS(settings)` — what does the `settings` argument look like? We see `assertAnalysisSettings_CodeWAS()` in the exports. Is there a builder function (e.g., `createAnalysisSettings_CodeWAS()`) or do we construct the list manually? What are the required fields?

**Q-CO2-2:** The `execute_*` functions — do they return a result object directly, or do they write results to a database table? If they write to a table, what is the table name and schema? How do we read the results back?

**Q-CO2-3:** `checkResults_CodeWAS()` — is this meant to be called after `execute_CodeWAS()`? What does it validate, and what does it return on pass vs fail?

**Q-CO2-4:** For GWAS — `runGWASAnalysis()` and `runRegenieStandardPipeline()` — do these require external tools (PLINK, Regenie) installed in the environment, or can they run with R packages alone? What are the system dependencies?

**Q-CO2-5:** `createSandboxAPIConnection()` — what is the sandbox API? Is this a local testing endpoint, or does it connect to a remote FinnGen service? We currently don't use this function.

**Q-CO2-6:** The overlap analysis (`execute_CohortOverlaps`) — does this compute pairwise overlap between all cohort pairs, or between a target and comparators? What does the result structure look like?

**Q-CO2-7:** The module settings Shiny modules (`mod_analysisSettings_codeWAS_ui/server`) — do these produce a standardized settings list that gets passed to `execute_CodeWAS()`? If so, can you describe the key fields in that settings list?

**Q-CO2-8:** For comparative effectiveness — the original tool shows forest plots with hazard ratios. Does the R package compute actual Cox proportional hazard models, or are these approximations? We currently derive effect sizes from event counts divided by person counts.

---

## 5. Cross-Tool Workflow

### What Parthenon currently does

- ROMOPAPI → HADES: passes schema scope, query template, and domain filter to pre-populate HADES SQL template
- HADES → Cohort Ops: passes cohort table name and rendered SQL to pre-populate operation settings
- Cohort Ops → CO2: passes cohort reference, row count, operation type, selected cohorts, and matching context
- Each handoff marks the previous step complete in a workflow stepper and auto-advances

### Questions

**Q-CROSS-1:** In the original FinnGen workflow, is there a defined handoff contract between the tools? For example, does ROMOPAPI produce a specific output object that HADES consumes? Or do the tools operate independently with the user copying data between them?

**Q-CROSS-2:** The `mod_analysisWrap_server` in CohortOperations2 — does this directly invoke CO2 modules, or does it prepare a settings file that CO2 reads independently?

**Q-CROSS-3:** Is there a "study package" concept that ties all four tools together? For example, does the full workflow produce a single exportable study package (like an OHDSI study package) that contains the ROMOPAPI report, HADES-rendered SQL, cohort definitions, and CO2 analysis results?

---

## Infrastructure Notes

For context on how Parthenon connects to your packages:

- **R packages installed:** All four packages + DatabaseConnector, SqlRender, CohortGenerator, FeatureExtraction, Eunomia, ROhdsiWebApi, CommonDataModel, Andromeda, ResultModelManager, ParallelLogger (installed from GitHub + local `/opt/finngen/` mounts)
- **JDBC:** PostgreSQL 42.7.3 driver, DatabaseConnector JDBC mode
- **CDM connection:** `pgsql.acumenus.net:5432/ohdsi`, schemas: `omop` (CDM+vocab), `achilles_results` (results)
- **R execution:** Via `Rscript -e "..."` subprocess from Python HTTP server, JSON output parsed back
- **Container:** `python:3.12-slim` base with `r-base`, 40+ `r-cran-*` packages, Java 21

If you'd like to test directly, the Workbench is at `https://parthenon.acumenus.net/workbench` (credentials available on request).

---

## Response Format

For each question, a short answer is fine:

```
Q-ROM-1: getCodeCounts takes CDMdbHandler only, schema is embedded. Correct.
Q-ROM-2: Table names are code_counts and stratified_code_counts in the results schema.
         Function writes to DB, read back with querySql.
...
```

If a question reveals a misunderstanding in our implementation, please note what should change. If you'd prefer to review a specific file, we can share the relevant source code.

Thank you for your time.
