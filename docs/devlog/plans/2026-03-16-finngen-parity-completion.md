# FINNGEN 100% Parity — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps in the FINNGEN parity plan (Phases A-E) using hybrid approach — backend queries real CDM for data-grounded results, runner handles R-specific logic when packages are available.

**Architecture:** FinnGenWorkbenchService.php already has DynamicConnectionFactory, schema qualification, and the adapter-first fallback pattern. We replace synthetic data generators with real CDM queries while keeping the external adapter path for upstream R package execution. Each phase targets a specific tool's gaps.

**Tech Stack:** Laravel 11 / PHP 8.4, PostgreSQL CDM queries via DynamicConnectionFactory, existing CohortOverlapService / SqlRendererService / AtlasCohortImportService

---

## Phase A: ROMOPAPI — Real CDM Queries (72% → 93%)

### Task A1: Real code counts from CDM

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `romopapi()` method and new `queryCdmCodeCounts()` private method

- [ ] **Step 1:** Add `queryCdmCodeCounts()` method that queries the actual CDM:
  - Query `{cdm_schema}.condition_occurrence` joined with `{vocab_schema}.concept` for condition counts
  - Query `{cdm_schema}.drug_exposure` joined with concept for drug counts
  - Query `{cdm_schema}.measurement` joined with concept for measurement counts
  - Filter by `concept_domain` parameter when not 'all'
  - Apply `result_limit` parameter
  - Return array of `[concept, count, domain, stratum]`

- [ ] **Step 2:** Add `queryCdmStratifiedCounts()` method:
  - When `stratify_by` = 'sex': GROUP BY `p.gender_concept_id` joined to concept for label
  - When `stratify_by` = 'age_band': GROUP BY `FLOOR((EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) / 10) * 10`
  - When `stratify_by` = 'care_site': GROUP BY `cs.care_site_name`
  - Return array of `[label, count, percent]`

- [ ] **Step 3:** Replace hardcoded `buildRomopapiCodeCounts()` call in `romopapi()` with `queryCdmCodeCounts()`, wrapped in try-catch falling back to synthetic

- [ ] **Step 4:** Replace hardcoded stratified counts with `queryCdmStratifiedCounts()`, same try-catch pattern

- [ ] **Step 5:** Commit: `feat: ROMOPAPI real CDM code counts and stratified counts`

### Task A2: Real schema nodes from information_schema

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — new `queryCdmSchemaNodes()` method

- [ ] **Step 1:** Add `queryCdmSchemaNodes()` — query `information_schema.tables` and `information_schema.columns` for the CDM schema:
  - Get table names, column counts (as proxy for "connections")
  - Get estimated row counts via `pg_class.reltuples`
  - Filter to CDM tables only (person, visit_occurrence, condition_occurrence, etc.)

- [ ] **Step 2:** Replace hardcoded `buildSchemaNodes()` with `queryCdmSchemaNodes()` in `romopapi()`, try-catch fallback

- [ ] **Step 3:** Commit: `feat: ROMOPAPI real schema node discovery from CDM`

### Task A3: Dynamic report content

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `buildRomopapiMarkdownReport()` and `buildRomopapiHtmlReport()`

- [ ] **Step 1:** Update `buildRomopapiMarkdownReport()` to use real code counts and schema nodes (already passed as parameters, just need richer content)

- [ ] **Step 2:** Update `buildRomopapiHtmlReport()` to include code count table rows from real data

- [ ] **Step 3:** Add report bundle metadata: request method, cache mode, generation timestamp, source dialect

- [ ] **Step 4:** Commit: `feat: ROMOPAPI dynamic report content from real CDM data`

### Task A4: Cache lifecycle materialization

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `romopapi()` cache handling

- [ ] **Step 1:** Make cache_mode='refresh' bypass cache read but write result
- [ ] **Step 2:** Make cache_mode='bypass' skip both read and write
- [ ] **Step 3:** Add cache_hit/cache_miss/cache_refreshed markers to response metadata
- [ ] **Step 4:** Commit: `feat: ROMOPAPI materialized cache lifecycle`

---

## Phase B: HADES Extras — Config Validation (68% → 94%)

### Task B1: YAML parse with real validation

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `parseHadesConfigYaml()` and `hadesExtras()`

- [ ] **Step 1:** Add structured YAML validation in `parseHadesConfigYaml()`:
  - Required keys check: `package.name`, `render.target`
  - Dialect compatibility: validate render.target against known dialects
  - Schema reference validation: check cohort.table format
  - Return `['config' => [...], 'errors' => [...], 'warnings' => [...]]`

- [ ] **Step 2:** Wire validation results into `config_validation` array in `hadesExtras()` response

- [ ] **Step 3:** Commit: `feat: HADES real YAML parse validation with structured errors`

### Task B2: Cohort table lifecycle with real queries

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — new `queryHadesCohortTableStatus()` method

- [ ] **Step 1:** Add `queryHadesCohortTableStatus()`:
  - Check if cohort table exists: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`
  - Get row count: `SELECT COUNT(*) FROM {results_schema}.{table_name}`
  - Get distinct cohort_definition_ids: `SELECT COUNT(DISTINCT cohort_definition_id) FROM ...`
  - Validate required columns: cohort_definition_id, subject_id, cohort_start_date, cohort_end_date

- [ ] **Step 2:** Wire into `cohort_table_lifecycle` array in `hadesExtras()` with real statuses

- [ ] **Step 3:** Commit: `feat: HADES real cohort table lifecycle queries`

### Task B3: Connection/config validation

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php`

- [ ] **Step 1:** Add `validateHadesConfig()` — check source dialect vs render target compatibility, verify CDM connection is reachable, validate package skeleton supports the target dialect

- [ ] **Step 2:** Wire into `config_validation` array alongside YAML validation results

- [ ] **Step 3:** Commit: `feat: HADES connection and config compatibility validation`

### Task B4: Structured helper logs

- [ ] **Step 1:** Add real connection test log entry (try `DB::connection($conn)->selectOne('SELECT 1')`)
- [ ] **Step 2:** Add real EXPLAIN output for rendered SQL (already partially exists)
- [ ] **Step 3:** Commit: `feat: HADES structured helper logs from real execution`

---

## Phase C: Cohort Ops — Real Operation Metrics (50% → 93%)

### Task C1: Real cohort sizes from CDM

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `cohortOperations()`

- [ ] **Step 1:** When import_mode='parthenon' and selected cohorts have SQL, execute `SELECT COUNT(*) FROM ({compiled_sql}) preview` for each cohort to get real sizes

- [ ] **Step 2:** Use real sizes in `buildOperationMetrics()` instead of synthetic percentages — but compute actual set-operation sizes:
  - Union: sum of sizes minus estimated overlap
  - Intersect: use CohortOverlapService result
  - Subtract: primary size minus overlap with comparators

- [ ] **Step 3:** Commit: `feat: Cohort Ops real cohort sizes from CDM queries`

### Task C2: Real matching samples from CDM

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `buildMatchingSamples()` replacement

- [ ] **Step 1:** Add `queryMatchingSamples()` — query actual person rows from CDM:
  ```sql
  SELECT p.person_id, p.year_of_birth, c.concept_name as gender,
         EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth as age
  FROM {cdm_schema}.person p
  JOIN {vocab_schema}.concept c ON p.gender_concept_id = c.concept_id
  WHERE p.person_id IN (SELECT subject_id FROM ({cohort_sql}) cohort LIMIT 10)
  ```

- [ ] **Step 2:** Split into matched/excluded samples based on propensity score approximation (age + gender similarity)

- [ ] **Step 3:** Replace `buildMatchingSamples()` calls with `queryMatchingSamples()`, try-catch fallback to synthetic

- [ ] **Step 4:** Commit: `feat: Cohort Ops real matching samples from CDM person table`

### Task C3: File import with validation

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — file import branch in `cohortOperations()`

- [ ] **Step 1:** Add `validateFileImport()` — check file_format (csv/json), validate required columns (subject_id, cohort_start_date), parse row count, return structured validation result

- [ ] **Step 2:** Add `file_import_summary` with validation status, parsed columns, row count, detected format

- [ ] **Step 3:** Commit: `feat: Cohort Ops file import validation and summary`

### Task C4: Export artifact generation

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php`

- [ ] **Step 1:** Add `buildExportBundle()` — generate real export artifacts:
  - Compiled SQL as downloadable artifact
  - Cohort manifest (selected cohorts, operation type, matching config)
  - Sample data as CSV-ready artifact

- [ ] **Step 2:** Wire into `export_summary` and `artifacts` arrays

- [ ] **Step 3:** Commit: `feat: Cohort Ops real export artifact bundle generation`

### Task C5: Stronger handoff to CO2

- [ ] **Step 1:** Include real cohort size, real overlap metrics, and operation evidence in handoff context
- [ ] **Step 2:** Persist handoff source_id and cohort SQL reference for CO2 to re-query
- [ ] **Step 3:** Commit: `feat: Cohort Ops → CO2 handoff with real cohort context`

---

## Phase D: CO2 Modules — Execution Depth (50% → 95%)

### Task D1: Wire buildCo2ResultValidation()

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `co2Analysis()`

- [ ] **Step 1:** Call `buildCo2ResultValidation()` (already exists at line 2620) and include result in response as `result_validation`
- [ ] **Step 2:** Commit: `fix: CO2 wire existing result validation into response`

### Task D2: Real CDM-backed analysis metrics

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php`

- [ ] **Step 1:** Add `queryCo2PersonCount()` — query actual person count from CDM for the analysis cohort
- [ ] **Step 2:** Add `queryCo2TopSignals()` — query top condition/drug concepts by frequency from the CDM, filtered by module family domain
- [ ] **Step 3:** Add `queryCo2UtilizationTrend()` — query event counts grouped by year-month from condition_occurrence or drug_exposure
- [ ] **Step 4:** Replace synthetic person_count, top_signals, and utilization_trend with real CDM queries, try-catch fallback
- [ ] **Step 5:** Commit: `feat: CO2 real CDM-backed person counts, signals, and trends`

### Task D3: GWAS parameter usage

- [ ] **Step 1:** Make `gwas_method` affect the analysis_summary and forest_plot framing (regenie vs logistic vs linear produce different effect labels)
- [ ] **Step 2:** Make `gwas_trait` appear in analysis_summary, module_setup, and report metadata
- [ ] **Step 3:** Add GWAS-specific job_summary with method, trait, status fields
- [ ] **Step 4:** Commit: `feat: CO2 GWAS uses method and trait parameters`

### Task D4: timeCodeWAS parameter usage

- [ ] **Step 1:** Make `time_window_count` and `time_window_unit` materially affect `temporal_windows` output (generate N windows of the specified unit)
- [ ] **Step 2:** Make time_profile entries correspond to the configured windows
- [ ] **Step 3:** Commit: `feat: CO2 timeCodeWAS uses time window parameters`

### Task D5: Module-family settings validation

- [ ] **Step 1:** Add `validateCo2ModuleSettings()` — check required fields per module family:
  - comparative_effectiveness: requires comparator_label
  - gwas_preview: requires gwas_trait, gwas_method
  - condition_burden: requires burden_domain
  - drug_utilization: requires exposure_window
  - timecodewas_preview: requires time_window_count, time_window_unit
- [ ] **Step 2:** Return validation errors in `module_validation` array
- [ ] **Step 3:** Commit: `feat: CO2 per-family settings validation`

### Task D6: Family-specific artifacts

- [ ] **Step 1:** Generate family-specific artifact entries (result table as CSV, forest plot data as JSON, analysis config as YAML)
- [ ] **Step 2:** Wire into `analysis_artifacts` array in response
- [ ] **Step 3:** Commit: `feat: CO2 family-specific analysis artifacts`

---

## Phase E: Cross-Tool Integration (60% → 100%)

### Task E1: ROMOPAPI → HADES handoff

**Files:**
- Modify: `backend/app/Services/StudyAgent/FinnGenWorkbenchService.php` — `hadesExtras()`
- Modify: `frontend/src/features/finngen/pages/FinnGenToolsPage.tsx`

- [ ] **Step 1:** Accept optional `romopapi_context` in HADES options — schema scope, query template, domain filter from a prior ROMOPAPI run
- [ ] **Step 2:** When present, pre-populate SQL template with schema-qualified queries from ROMOPAPI context
- [ ] **Step 3:** Add frontend handoff: ROMOPAPI results show "Use in HADES →" button that passes context and advances stepper
- [ ] **Step 4:** Commit: `feat: ROMOPAPI → HADES cross-tool handoff`

### Task E2: HADES → Cohort Ops handoff

- [ ] **Step 1:** Accept optional `hades_context` in CohortOps options — package config, cohort table reference, rendered SQL
- [ ] **Step 2:** When present, pre-populate cohort table name and export target from HADES config
- [ ] **Step 3:** Add frontend handoff button in HADES results
- [ ] **Step 4:** Commit: `feat: HADES → Cohort Ops cross-tool handoff`

### Task E3: Standardize artifact format

- [ ] **Step 1:** Define shared artifact structure: `{ name, type, mime_type, size_hint, content_hash, download_ready }`
- [ ] **Step 2:** Update all four tools to use this format
- [ ] **Step 3:** Commit: `refactor: standardize artifact format across all FINNGEN tools`

### Task E4: Run inspector consistency

- [ ] **Step 1:** Ensure all four tools persist: request_envelope, runtime, artifacts, validation, cache_status
- [ ] **Step 2:** Update run comparison to handle all shared fields
- [ ] **Step 3:** Commit: `feat: consistent run inspector fields across all tools`

### Task E5: Update parity estimates

- [ ] **Step 1:** Update `docs/finland/finngen-100-percent-parity-plan.md` with actual completion status
- [ ] **Step 2:** Update `docs/finland/finngen-parity-gap-analysis-and-backlog.md` to reflect closed gaps
- [ ] **Step 3:** Commit: `docs: update FINNGEN parity estimates after completion`

---

## Verification

After each phase:
1. `cd backend && vendor/bin/phpstan analyse` — PHPStan level 8
2. `cd frontend && npx tsc --noEmit` — TypeScript clean
3. `cd frontend && npx vitest run src/features/finngen` — Tests pass
4. `./deploy.sh` — Production build succeeds
5. Manual: Run each tool against Acumenus CDM source at `/workbench`
