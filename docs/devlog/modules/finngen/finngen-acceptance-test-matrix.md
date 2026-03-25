# FINNGEN Workbench Acceptance Test Matrix

## Purpose

This matrix defines the acceptance tests for verifying all four FINNGEN tools operate correctly against the Acumenus OHDSI CDM. Each test should be run from the Workbench at `/workbench` with the Acumenus source selected.

## Pre-conditions

- [ ] Acumenus CDM source visible in CDM dropdown
- [ ] All 4 workflow steps visible in stepper
- [ ] FinnGen runner container healthy (`docker compose ps | grep finngen-runner`)
- [ ] CDM database accessible (`docker compose exec php php artisan tinker --execute="DB::connection('cdm')->selectOne('SELECT 1')"`)

---

## ROMOPAPI Tests

### T-ROM-1: Schema discovery
- [ ] Select schema scope matching the CDM schema (e.g., `cdm` or `eunomia`)
- [ ] Click "Run Query Plan Preview"
- [ ] **Verify:** Metadata Summary shows real table count and dialect
- [ ] **Verify:** Schema Graph shows real CDM tables (person, condition_occurrence, etc.)
- [ ] **Verify:** Tables show non-zero estimated rows

### T-ROM-2: Code counts by domain
- [ ] Expand Advanced Options
- [ ] Set Concept domain to "Condition"
- [ ] Click "Run Query Plan Preview"
- [ ] **Verify:** Code Counts show real condition concept names (not table names)
- [ ] **Verify:** Counts are non-zero integers from the CDM
- [ ] **Verify:** Domain column shows "Condition" for all rows

### T-ROM-3: Stratified counts
- [ ] Set Stratify by to "Sex"
- [ ] Click "Run Query Plan Preview"
- [ ] **Verify:** Stratified Counts show "Male" and "Female" (or concept names from gender_concept_id)
- [ ] **Verify:** Percentages sum to ~100%

### T-ROM-4: Cache lifecycle
- [ ] Run with Cache mode = "Memoized preview" — note cache_status shows "generated"
- [ ] Run again with same parameters — **verify** cache_status shows "hit"
- [ ] Run with Cache mode = "Refresh" — **verify** cache_status shows "generated" (not hit)
- [ ] Run with Cache mode = "Bypass" — **verify** cache_status shows "bypassed"

### T-ROM-5: Report download
- [ ] After a successful run, verify Report Preview shows markdown content
- [ ] Click "Download Markdown Report" — file downloads with real content
- [ ] Click "Download HTML Report" — file downloads with table of real tables

### T-ROM-6: Cross-tool handoff
- [ ] After a successful run, click "Use in HADES Extras →"
- [ ] **Verify:** Stepper advances to step 2
- [ ] **Verify:** ROMOPAPI step marked as completed (icon changes)

---

## HADES Extras Tests

### T-HAD-1: SQL rendering
- [ ] Enter SQL template: `SELECT person_id, COUNT(*) FROM @cdm_schema.condition_occurrence GROUP BY person_id LIMIT 10`
- [ ] Click "Render Preview"
- [ ] **Verify:** SQL Preview shows template vs rendered with real schema substitution
- [ ] **Verify:** Rendered SQL has actual schema name instead of `@cdm_schema`

### T-HAD-2: EXPLAIN plan
- [ ] After rendering a SELECT query, verify Detailed Results → Explain Plan shows real PostgreSQL explain output
- [ ] **Verify:** explain plan is not an error message

### T-HAD-3: Cohort table lifecycle
- [ ] Set Cohort table to `results.cohort` (or a known existing table)
- [ ] Click "Render Preview"
- [ ] Expand Detailed Results
- [ ] **Verify:** Cohort Table Lifecycle shows "ready" for Resolve if table exists
- [ ] **Verify:** Shows real row count and column validation

### T-HAD-4: YAML validation
- [ ] Expand Advanced Options
- [ ] Enter invalid YAML in the config field (e.g., missing required keys)
- [ ] Click "Render Preview"
- [ ] **Verify:** Config validation shows "review" status for missing fields

### T-HAD-5: Package bundle download
- [ ] After a successful render, verify Package Bundle shows bundle metadata
- [ ] Click "Download Bundle Metadata" — file downloads

### T-HAD-6: Cross-tool handoff
- [ ] After a successful render, click "Use in Cohort Ops →"
- [ ] **Verify:** Stepper advances to step 3
- [ ] **Verify:** Cohort table name is pre-populated from HADES config

---

## Cohort Operations Tests

### T-COH-1: Parthenon cohort selection
- [ ] Click Operation Builder card
- [ ] Select at least one existing Parthenon cohort
- [ ] Click "Apply Builder"
- [ ] Click "Run Cohort Preview"
- [ ] **Verify:** Compile Summary shows real cohort count from CDM
- [ ] **Verify:** Attrition Funnel shows real step-by-step filtering

### T-COH-2: Multi-cohort operation
- [ ] Open Operation Builder
- [ ] Select 2+ Parthenon cohorts
- [ ] Set operation type to "Union"
- [ ] Click "Apply Builder" then "Run Cohort Preview"
- [ ] **Verify:** Operation metrics show overlap-grounded results (from CohortOverlapService)
- [ ] **Verify:** Operation Comparison shows real pairwise overlap and Jaccard index

### T-COH-3: Matching samples
- [ ] Enable matching in Operation Builder
- [ ] Set strategy to "Nearest neighbor"
- [ ] Run Cohort Preview
- [ ] **Verify:** Matching Review shows real person_ids from CDM person table
- [ ] **Verify:** Age and sex values are realistic (not synthetic 44+7n pattern)

### T-COH-4: Drag/drop cohort reorder
- [ ] Select 3+ cohorts in Operation Builder
- [ ] **Verify:** "Cohort Order" section appears with numbered items
- [ ] Drag a cohort to a different position
- [ ] **Verify:** Order updates, numbers re-sequence
- [ ] **Verify:** First cohort is labeled as anchor for subtract operations

### T-COH-5: File import
- [ ] Set Import path to "File import"
- [ ] Upload or paste a CSV with `person_id,cohort_start_date` columns
- [ ] Run Cohort Preview
- [ ] **Verify:** File Import Summary shows parsed columns and row count

### T-COH-6: Handoff to CO2
- [ ] After a successful cohort preview, click "Hand Off To CO2 Modules"
- [ ] **Verify:** Stepper advances to step 4
- [ ] **Verify:** CO2 tab shows "Received from Cohort Ops" badge with row count

---

## CO2 Analysis Tests

### T-CO2-1: Comparative effectiveness
- [ ] Set Module key to "Comparative effectiveness"
- [ ] Set Cohort label and Outcome name
- [ ] Click "Run Module Preview"
- [ ] **Verify:** Analysis Summary shows real person count from CDM
- [ ] **Verify:** Forest Plot shows effect estimates
- [ ] **Verify:** Top Signals shows real concept names from CDM

### T-CO2-2: CodeWAS
- [ ] Set Module key to "CodeWAS preview"
- [ ] Run Module Preview
- [ ] **Verify:** Top signals show condition/drug concepts from the CDM

### T-CO2-3: timeCodeWAS with window parameters
- [ ] Set Module key to "timeCodeWAS preview"
- [ ] Set Time window count to 6, Time window unit to "months"
- [ ] Run Module Preview
- [ ] **Verify:** Temporal Windows shows 6 entries (not default 4)
- [ ] **Verify:** Window labels mention "months"

### T-CO2-4: GWAS parameters
- [ ] Set Module key to "GWAS preview"
- [ ] Set GWAS trait to "Hypertension", GWAS method to "logistic"
- [ ] Run Module Preview
- [ ] **Verify:** Analysis Summary mentions "logistic" method
- [ ] **Verify:** Family Spotlight shows "Hypertension" trait

### T-CO2-5: Result validation
- [ ] After any CO2 run, expand Detailed Results
- [ ] **Verify:** Result Validation shows check items (cohort context, result rows, signals, temporal, population floor)

### T-CO2-6: Module artifact download
- [ ] After a successful run, check Run History section
- [ ] Select a run, click Export Bundle
- [ ] **Verify:** Bundle downloads with analysis_summary.json, result_table.json, etc.

---

## Cross-Tool Workflow Tests

### T-CROSS-1: Full pipeline
- [ ] Step 1: Run ROMOPAPI query plan → click "Use in HADES →"
- [ ] Step 2: Render SQL in HADES → click "Use in Cohort Ops →"
- [ ] Step 3: Select cohorts, run preview → click "Hand Off To CO2 →"
- [ ] Step 4: Run CO2 module preview
- [ ] **Verify:** All 4 stepper steps marked as completed
- [ ] **Verify:** CO2 results reflect the cohort context from step 3

### T-CROSS-2: Run replay
- [ ] Run any tool, note the Run ID
- [ ] In Run History, select the run
- [ ] Click "Replay Run"
- [ ] **Verify:** New run created with same parameters
- [ ] **Verify:** Results are consistent with original run

### T-CROSS-3: Run export
- [ ] Select a persisted run in Run History
- [ ] Click "Export Bundle"
- [ ] **Verify:** Downloaded JSON contains run metadata, request payload, result payload, and artifact payloads with real content

### T-CROSS-4: Run comparison
- [ ] Run the same tool twice with different parameters
- [ ] In Run History, select primary run, then choose comparison run
- [ ] **Verify:** Summary Delta shows differences between the two runs

---

## Verification Summary

| Tool | Tests | Coverage |
|------|-------|----------|
| ROMOPAPI | T-ROM-1 through T-ROM-6 | Schema, counts, stratification, cache, report, handoff |
| HADES Extras | T-HAD-1 through T-HAD-6 | SQL render, EXPLAIN, cohort table, YAML, bundle, handoff |
| Cohort Ops | T-COH-1 through T-COH-6 | Selection, operation, matching, drag/drop, file, handoff |
| CO2 Modules | T-CO2-1 through T-CO2-6 | CE, CodeWAS, timeCodeWAS, GWAS, validation, artifacts |
| Cross-tool | T-CROSS-1 through T-CROSS-4 | Pipeline, replay, export, comparison |

**Total: 28 acceptance tests**
