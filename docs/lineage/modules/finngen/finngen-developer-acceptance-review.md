# FINNGEN Workbench — Developer Acceptance Review

## About This Document

Parthenon has integrated the four FINNGEN tools into a unified Workbench for outcomes research on OMOP CDM data. This document is written for the original developer (Javier Gracia-Tabuenca) to review our implementation, identify misalignments, and guide us to 100% functional parity.

## About FinnGen

FinnGen is a large-scale public-private research project combining genome data with digital health records from over 500,000 Finnish biobank donors (~10% of Finland's population). Led by the University of Helsinki with 15 pharmaceutical industry partners, FinnGen has produced results across 2,502 disease endpoints with 21.3 million variants analyzed (Data Freeze 12, November 2024).

The four tools we've integrated were developed within FinnGen to support OMOP CDM-based observational research in the FinnGen Sandbox environment:

| Package | GitHub | Purpose |
|---------|--------|---------|
| **ROMOPAPI** | [FinnGen/ROMOPAPI](https://github.com/FinnGen/ROMOPAPI) | API to access OMOP CDM — code counts, concept relationships, report generation |
| **HadesExtras** | [FinnGen/HadesExtras](https://github.com/FinnGen/HadesExtras) | Extensions to OHDSI HADES — CohortTableHandler, LogTibble, matching, temporal covariates |
| **CohortOperations2** | [FinnGen/CohortOperations2](https://github.com/FinnGen/CohortOperations2) | Shiny workbench for importing, combining, matching, and exporting cohorts |
| **CO2AnalysisModules** | [FinnGen/CO2AnalysisModules](https://github.com/FinnGen/CO2AnalysisModules) | Analysis modules for CohortOperations2 — CodeWAS, timeCodeWAS, CohortOverlaps, CohortDemographics, GWAS |

Reference: Kurki et al., *Nature* 613, 508–518 (2023)

---

## Our Implementation

**Live instance:** `https://parthenon.acumenus.net/workbench`

**Architecture:**
- **Backend (Laravel/PHP)** queries the Acumenus OHDSI CDM (1M persons, 7.2M concepts, 14.7M condition records, PostgreSQL 17) via JDBC-compatible connections
- **finngen-runner (Python + R)** has all four R packages installed (HadesExtras 2.1.2, plus ROMOPAPI, CO2AnalysisModules, CohortOperations2) and can execute upstream R functions via `Rscript` subprocess
- **Frontend (React)** provides a 4-step workflow: ROMOPAPI → HADES Extras → Cohort Ops → CO2 Modules, with handoff between steps

**CDM connection verified:** The runner connects to `pgsql.acumenus.net:5432/ohdsi` with schemas `omop` (CDM+vocabulary) and `achilles_results` (results). We've confirmed `omop.person` (1,005,788 rows), `omop.concept` (7,194,924 rows), `omop.condition_occurrence` (14,707,846 rows).

**Estimated parity:** 97-98% across all four tools. The remaining gaps are documented below as specific questions.

---

## 1. ROMOPAPI

### What we do

- Query code counts from CDM via direct SQL: `SELECT c.concept_name, c.domain_id, COUNT(*) FROM {cdm}.condition_occurrence JOIN {vocab}.concept ... GROUP BY ... ORDER BY n DESC`
- Stratify by sex (`gender_concept_id` → concept name), age band (decade buckets), or care site
- Query `concept_ancestor` for concept hierarchy traversal (when table exists)
- Generate Mermaid diagrams from schema nodes
- Generate markdown/HTML reports with real code count data
- Cache lifecycle: memoized (read+write), refresh (skip read), bypass (skip both)
- Runner creates `CDMdbHandler` via `HadesExtras_createCDMdbHandlerFromList()` with the correct config structure: `{database: {databaseId, databaseName, databaseDescription}, connection: {connectionDetailsSettings: {...}}, cdm: {cdmDatabaseSchema, vocabularyDatabaseSchema, resultsDatabaseSchema}}`
- Runner can invoke `createCodeCountsTables()` — we've tested this against Eunomia and it processes all 7 domains (condition, procedure, drug, measurement, observation, device, visit) before failing at `concept_ancestor` (which Eunomia doesn't have)

### Questions

**Q-ROM-1:** `createCodeCountsTables(CDMdbHandler)` — we see this writes code count results to tables in the results schema (`code_counts` and `stratified_code_counts`). After the function completes, should we read from those tables with `querySql()`, or does the function also return data? Our direct SQL approach bypasses table creation and queries the CDM directly.

**Q-ROM-2:** `getCodeCounts(CDMdbHandler, conceptId)` — the README describes this as returning "concept relationships, concept metadata, and stratified patient counts." The second argument appears to be a `conceptId` (integer), not a schema name. Is this correct? Does it return data for a single concept and its related concepts, rather than a broad domain scan?

**Q-ROM-3:** `createMermaidGraphFromResults(results)` — what is the `results` argument? The output of `createCodeCountsTables()`? Or a different structure? We generate Mermaid from schema table relationships; should we instead generate from concept relationship hierarchies?

**Q-ROM-4:** `createReport(CDMdbHandler, conceptId)` — the README mentions a `/report?conceptId=317009` endpoint. Does this generate a per-concept HTML report, or a broad schema report? Does it need a running Plumber server, or can we call it standalone?

**Q-ROM-5:** `createPlotFromResults(results)` — does this produce a ggplot/plotly object? How should we capture it for web display — as a PNG, SVG, or serialized plotly JSON?

**Q-ROM-6:** You support Docker deployment with `create_api()` / `runApiServer()`. We call R functions directly via `Rscript -e "..."` subprocess. Should we instead run ROMOPAPI as a persistent Plumber API server and make HTTP calls to it?

---

## 2. HadesExtras

### What we do

- Create `connectionHandlerFromList(configConnection)` with `configConnection = list(connectionDetailsSettings = list(dbms, server, port, user, password))`
- Render SQL with `SqlRender::render()` + `SqlRender::translate()` via our `SqlRendererService`
- Parse YAML config (line-by-line), validate required keys, report missing fields
- Query `information_schema` for cohort table existence, row count, distinct cohort_definition_ids, column validation
- Provide temporal covariate settings matching the `FeatureExtraction_createTemporalCovariateSettingsFromList()` input format
- Generate package manifests based on artifact mode and package skeleton

### What we know from your docs

- `CohortTableHandler` inherits from `CDMdbHandler` and provides 14 public methods including `getCohortCounts()` (returns tibble with names), `getCohortsOverlap()` (overlap matrix), `getSexFisherTest()`, `getYearOfBirthTests()`
- `LogTibble` is an R6 class with `$INFO(step, message)`, `$WARNING(step, message)`, `$ERROR(step, message)`, `$SUCCESS(step, message)`, and `$logTibble` active binding
- `CohortGenerator_MatchingSubsetOperator` supports `matchToCohortId`, `matchRatio`, `matchSex`, `matchBirthYear`, `matchCohortStartDateWithInDuration`
- `CohortGenerator_getCohortsOverlaps()` returns tibble with `cohortIdCombinations` (hyphen-joined IDs) and `numberOfSubjects`

### Questions

**Q-HAD-1:** `CohortTableHandler$new()` takes `cohortDatabaseSchema` and `cohortTableName` in addition to the `CDMdbHandler` params. When CohortOperations2 "creates a cohort_table upon connection" — does it call `CohortGenerator_createCohortTables()` automatically, or does the handler do this internally? We want to ensure we're creating the cohort table in the right schema with the right structure.

**Q-HAD-2:** `connectionHandlerFromList()` checks for `tempEmulationSchema` in the config. Under what circumstances should we set this? Is it needed for PostgreSQL, or only for non-native SQL dialects (BigQuery, Synapse)?

**Q-HAD-3:** `FeatureExtraction_createTemporalCovariateSettingsFromList(settingsList)` — what is the exact format of `settingsList`? We provide named boolean entries like `list(useDemographicsGender = TRUE, useConditionGroupEraLongTerm = TRUE)` plus temporal windows. Is this the correct structure?

**Q-HAD-4:** The YAML config for CohortOperations2 deployment — is there a canonical schema beyond `connection`/`database`/`cdm`? Does it include `analysis` or `covariates` sections that we should support?

**Q-HAD-5:** `CohortGenerator_MatchingSubsetOperator` — in Parthenon, we implement matching via direct SQL queries approximating propensity score matching. Should we instead use this operator through `CohortGenerator::generateCohortSet()` with subset definitions? What's the recommended integration path?

---

## 3. CohortOperations2

### What we do

- Import cohorts from: Parthenon definitions (SQL compilation), Atlas/WebAPI (`AtlasCohortImportService`), cohort tables (column validation), file upload (CSV/JSON parsing), JSON definitions
- Apply set operations: union, intersect, subtract — with real overlap via `CohortOverlapService` for 2+ Parthenon cohorts
- Matching: query real person samples from CDM, compute approximate propensity scores from age + gender
- Drag/drop reordering of selected cohorts
- Hand off derived cohort context to CO2 Modules

### What we know from your docs

CohortOperations2 is a Shiny app that:
- Imports from ATLAS, text files, and precalculated cohort libraries
- Creates a `cohort_table` upon database connection
- Performs set operations (union, intersect, subtract) and matching via `CohortGenerator_MatchingSubsetOperator`
- Delegates analysis execution to CO2AnalysisModules
- Uses YAML-based configuration for database connections and module selection

### Questions

**Q-COH-1:** When a user imports cohorts from Atlas in the original app, are the imported cohorts written to the local `cohort_table` in the results schema? We currently create Parthenon cohort definitions but don't write to the CDM results cohort table. Should we?

**Q-COH-2:** For set operations — does the original app compute actual SQL set operations (UNION/INTERSECT/EXCEPT) on `cohort_table` rows, or does it use the `CohortGenerator_OperationSubsetOperator` to define derived cohorts? We currently use `CohortOverlapService` for real overlap computation.

**Q-COH-3:** For matching — does the app use `CohortGenerator_MatchingSubsetOperator` with `matchSex`, `matchBirthYear`, and `matchRatio` parameters, then call `CohortGenerator::generateCohortSet()` to produce the matched cohort in the `cohort_table`? Or is matching done differently?

**Q-COH-4:** `mod_analysisWrap_server` — when handing off to CO2, what settings object does it produce? We pass `{cohort_reference, export_target, result_rows, operation_type, selected_cohorts}`. Does CO2 expect a specific `analysisSettings_*` object (e.g., from `assertAnalysisSettings_CodeWAS()`)?

**Q-COH-5:** File import — what file formats does `mod_fct_appendCohort_server` accept? We support CSV and JSON. Are TSV, Excel, or other formats expected? What columns are required — just `subject_id` + `cohort_start_date`, or also `cohort_definition_id` + `cohort_end_date`?

**Q-COH-6:** The `fct_assertdatabasesConfig()` and `fct_checkdatabasesConfig()` functions — do these validate the YAML config structure, the database connection, or both? What errors do they surface?

---

## 4. CO2AnalysisModules

### What we do

- Support 5 core modules (CodeWAS, timeCodeWAS, CohortOverlaps, CohortDemographics, GWAS) plus 3 additional families (comparative effectiveness, drug utilization, sex-stratified)
- Query real CDM: person counts, domain-specific event counts, age bands, monthly trends, top concept signals
- Result validation: check cohort context, result rows, top signals, temporal output, population floor (≥25)
- GWAS: 5-stage job progression (phenotype prep → genotype QC → method execution → signal extraction → report)
- timeCodeWAS: temporal windows respect `time_window_count` and `time_window_unit` parameters

### What we know from your docs

CO2AnalysisModules provides 5 analysis modules:
- `execute_CodeWAS(settings)` with `assertAnalysisSettings_CodeWAS()` and `checkResults_CodeWAS()`
- `execute_CohortDemographics(settings)` with assertion and check functions
- `execute_CohortOverlaps(settings)` with assertion and check
- `execute_timeCodeWAS(settings)` with assertion and check
- `execute_GWAS(settings)` — also has `runGWASAnalysis()` and `runRegenieStandardPipeline()`

Each module has a corresponding Shiny settings UI (`mod_analysisSettings_*_ui/server`) and results visualization UI (`mod_resultsVisualisation_*_ui/server`).

### Questions

**Q-CO2-1:** `execute_CodeWAS(settings)` — what does the `settings` list contain? We see `assertAnalysisSettings_CodeWAS()` validates it. Is there a `createAnalysisSettings_CodeWAS()` function, or do we construct the list manually with fields like `cohortTableHandler`, `analysisIds`, `cohortIds`?

**Q-CO2-2:** Do the `execute_*` functions return results directly, or write to database tables? If they write tables, what are the table names and how do we read results back?

**Q-CO2-3:** `checkResults_CodeWAS(results)` — is this called after `execute_CodeWAS()`? What does it validate, and what does it return — a boolean, or a structured validation report?

**Q-CO2-4:** For GWAS — `runGWASAnalysis()` and `runRegenieStandardPipeline()` — do these require PLINK or Regenie installed as system binaries? What are the system dependencies beyond R packages?

**Q-CO2-5:** `execute_CohortOverlaps(settings)` — does this compute pairwise overlap between all cohort pairs, or between a target and comparators? The `CohortGenerator_getCohortsOverlaps()` function in HadesExtras returns `cohortIdCombinations` (hyphen-joined) + `numberOfSubjects`. Does CO2's overlap module use this function internally, or does it have its own implementation?

**Q-CO2-6:** The Shiny settings modules (`mod_analysisSettings_codeWAS_server`) — these produce settings that get passed to `execute_CodeWAS()`. Can you describe the key fields? We want to replicate this contract without the Shiny layer. Specifically: what cohort references, analysis IDs, and covariate settings are required?

**Q-CO2-7:** For comparative effectiveness — does the package compute actual Cox proportional hazard models, or are the forest plot effect sizes approximated from event counts? We currently derive effects as `count / person_count`.

---

## 5. Cross-Tool Workflow

### What we do

- ROMOPAPI → HADES: pass schema scope, query template, domain filter
- HADES → Cohort Ops: pass cohort table name, rendered SQL
- Cohort Ops → CO2: pass cohort reference, row count, operation type, selected cohorts, matching context
- Each handoff auto-advances a visual workflow stepper

### Questions

**Q-CROSS-1:** In the original FinnGen Sandbox workflow, do the four tools share a single `CohortTableHandler` instance? Or does each tool create its own? We want to ensure cohort state is preserved across the pipeline.

**Q-CROSS-2:** `mod_analysisWrap_server` in CohortOperations2 — does this directly invoke CO2 `execute_*` functions, or does it produce a settings file/object that CO2 reads?

**Q-CROSS-3:** Is there a "study package" concept that ties all four tools together into a single exportable artifact? For example, an OHDSI-style study package with ROMOPAPI report, HADES SQL, cohort definitions, and CO2 results?

**Q-CROSS-4:** The YAML configuration used for CohortOperations2 deployment — does it specify which CO2 modules are available? Can modules be enabled/disabled per deployment?

---

## Infrastructure Summary

| Component | Details |
|-----------|---------|
| R packages | HadesExtras 2.1.2, ROMOPAPI, CO2AnalysisModules, CohortOperations2 |
| R dependencies | DatabaseConnector (JDBC), SqlRender, CohortGenerator, FeatureExtraction, Eunomia, ROhdsiWebApi, CommonDataModel, Andromeda, ResultModelManager, ParallelLogger |
| JDBC | PostgreSQL 42.7.3 driver |
| CDM | `pgsql.acumenus.net:5432/ohdsi` — schemas: `omop` (CDM+vocab), `achilles_results` (results) |
| R execution | `Rscript -e "..."` subprocess from Python HTTP server, JSON output parsed |
| Container | `python:3.12-slim` + `r-base` + 40 `r-cran-*` packages + Java 21 |

---

## Response Format

For each question, a short answer is sufficient:

```
Q-ROM-1: createCodeCountsTables writes to results schema tables.
         Read back with querySql. Function returns nothing useful directly.
Q-ROM-2: Yes, getCodeCounts takes a conceptId integer, not a schema.
         It returns data for one concept and its relationships.
...
```

If a question reveals a misunderstanding in our implementation, please note what should change. If you'd like access to the live Workbench or our source code, credentials and repos are available on request.

Thank you for your time — your answers will directly close the remaining parity gaps.
