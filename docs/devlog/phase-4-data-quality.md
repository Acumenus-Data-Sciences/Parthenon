# Phase 4: Data Quality & Characterization — Development Log

**Date:** 2026-03-01
**Branch:** `master`
**Status:** Complete, verified (Pint, PHPStan, TypeScript, Pest unit tests, Vitest all pass)

---

## Overview

Phase 4 replaces OHDSI's Achilles + DQD (Data Quality Dashboard) + Ares tools with an integrated Data Quality & Characterization engine. The pipeline covers: reading existing Achilles results, running fresh SQL analyses (~46 implemented), executing ~100 DQD checks across completeness/conformance/plausibility, and a full Data Explorer frontend replacing Ares with dark clinical themed charts and dashboards.

Tested against a live OHDSI PostgreSQL 17 database with 1M Synthea patients (1.15 TB), 1.38B clinical events, and pre-computed Achilles results (1.8M rows, 140 analyses).

---

## What Was Built

### Step 4A: Results Connection + Achilles Reader

**Database Connection:** Added `results` connection to `config/database.php` with configurable schema via `RESULTS_DB_SCHEMA` env var. Falls back to app DB defaults.

**Models (5 new):**
- `ResultsModel` — Abstract base for results schema, writable (unlike read-only CdmModel)
- `AchillesResult` — No PK, scopes for analysis filtering and stratum matching
- `AchillesResultDist` — Distribution data (min/p10/p25/median/p75/p90/max)
- `AchillesAnalysis` — Analysis definitions (analysis_id PK)
- `AchillesPerformance` — Execution timing records

**Service: `AchillesResultReaderService`** — 10 methods reading pre-computed Achilles results:
- `getRecordCounts()` — Counts for 17 CDM tables
- `getDemographics()` — Gender/race/ethnicity/age/YOB distributions
- `getObservationPeriods()` — Duration distributions, start/end trends, periods per person
- `getDomainSummary()` — Top concepts by prevalence for any of 6 domains
- `getConceptDrilldown()` — Per-concept gender/age/temporal/type detail
- `getTemporalTrends()` — Monthly event counts per domain
- `getDistribution()` — Box plot data from distribution analyses
- `getAvailableAnalyses()` / `getPerformanceReport()`

Uses Source model's `getTableQualifier(DaimonType::Results)` for schema resolution. Concept name resolution via vocab connection with inline constants for well-known gender concepts.

**Controller: `AchillesController`** — 9 REST endpoints under `/v1/sources/{source}/achilles/`.

**Migrations (5):** achilles_results, achilles_results_dist, achilles_analysis, achilles_performance (on `results` connection), dqd_results (on default app connection with bigint row counts).

**Model: `DqdResult`** — App-level model for DQD check results with source_id FK, uuid run_id, bigint violated/total rows.

### Step 4B: Achilles Analysis Engine

**Interface: `AchillesAnalysisInterface`** — Contract for analysis classes: analysisId, analysisName, category, sqlTemplate, isDistribution, requiredTables.

**Registry: `AchillesAnalysisRegistry`** — Stores/retrieves analyses by ID or category. Auto-discovered via DataQualityServiceProvider.

**Engine: `AchillesEngineService`** — Orchestrates analysis execution:
1. Resolves CDM + Results schemas via Source daimons
2. Renders SQL templates with `{@cdmSchema}` / `{@resultsSchema}` placeholders
3. DELETEs previous results, INSERTs new results
4. Records execution time in `achilles_performance`

**46 Analysis Classes** across 11 categories:

| Category | Count | Key Analyses |
|----------|-------|-------------|
| Person | 5 | Person count (0), gender (2), YOB (3), race (4), ethnicity (5) |
| Observation Period | 5 | Count (101), duration dist (105/109), start month (111), persons by count (108) |
| Visit | 4 | Count (200), type (201), gender (202), month (211) |
| Condition | 5 | Persons by concept (400), records (401), gender (402), age (404), month (411) |
| Drug | 4 | Persons by concept (700), records (701), gender (702), month (711) |
| Procedure | 4 | Persons by concept (600), records (601), gender (602), month (611) |
| Measurement | 4 | Persons by concept (1800), records (1801), gender (1802), month (1811) |
| Observation | 3 | Persons by concept (800), records (801), month (811) |
| Death | 3 | Count (500), cause (501), month (506) |
| Data Density | 2 | Records per person (117), domain counts (2000) |
| Drug Era / Condition Era | 4 | Era concepts (900, 901, 1000, 1001) |

**Queue Job: `RunAchillesJob`** — `achilles` queue, 3600s timeout, accepts source + optional category/analysis filters.

**Command: `parthenon:run-achilles`** — `{source} {--categories=} {--analyses=} {--fresh} {--sync}`

**Config:** Added `achilles` Horizon supervisor (maxProcesses 2, memory 1024MB, timeout 3600s).

### Step 4C: DQD Engine

**Interface: `DqdCheckInterface`** — Contract: checkId, category, subcategory, cdmTable, cdmColumn, severity, threshold, sqlViolated, sqlTotal, description.

**Registry: `DqdCheckRegistry`** — Stores/retrieves checks by ID, category, table, or combination.

**Engine: `DqdEngineService`** — Runs checks and stores results:
1. For each check: execute sqlViolated + sqlTotal on CDM connection
2. Compute violation percentage
3. Compare against threshold for pass/fail
4. Store DqdResult with timing

**~100 DQD Check Classes** using factory pattern:

| Category | Factory | Check Types | Count |
|----------|---------|-------------|-------|
| Completeness | `CompletenessCheckFactory` | RequiredFieldCheck, ValueCompletenessCheck, NonZeroConceptCheck | ~30 |
| Conformance | `ConformanceCheckFactory` | ConceptIdValidCheck, DomainConformanceCheck, ForeignKeyCheck, DateValidityCheck, StandardConceptCheck, TypeConceptValidCheck | ~40 |
| Plausibility | `PlausibilityCheckFactory` | NoFutureDateCheck, AgeRangeCheck, PositiveValueCheck, ObservationPeriodBoundsCheck, EventAfterBirthCheck, EventAfterDeathCheck, GenderSpecificCheck | ~30 |

**Controller: `DataQualityController`** — 8 endpoints under `/v1/sources/{source}/dqd/` for run management, results pagination, summaries, and dispatch.

**Queue Job: `RunDqdJob`** — `achilles` queue, 7200s timeout. Accepts source + optional category/table filter.

**Command: `parthenon:run-dqd`** — `{source} {--category=} {--table=} {--sync} {--fresh}`

**Provider: `DataQualityServiceProvider`** — Registers AchillesAnalysisRegistry and DqdCheckRegistry as singletons, auto-discovers analysis/check classes.

### Step 4D: Data Explorer Frontend (Ares Replacement)

**Types:** `dataExplorer.ts` — 20+ TypeScript interfaces covering Achilles results, DQD runs, box plot data, domain summaries, concept drilldowns.

**API Layer:**
- `achillesApi.ts` — 9 functions for Achilles endpoints
- `dqdApi.ts` — 8 functions for DQD endpoints

**Hooks:** `useAchillesData.ts` — 10 TanStack Query hooks with 5-minute cache for Achilles data, 1-minute for DQD.

**Chart Components (6):**
- `RecordCountsPanel` — Horizontal bar chart of CDM table record counts (recharts)
- `DemographicsPyramid` — Population pyramid with male/female bars
- `GenderPieChart` — Donut chart with center total count
- `TemporalTrendChart` — Multi-line time series
- `TopConceptsBar` — Horizontal bar with clickable concept bars
- `BoxPlotChart` — Custom SVG box plot (min/p10/p25/median/p75/p90/max)

**DQD Components (4):**
- `DqdScorecard` — SVG score rings (overall + 3 categories) with pass/fail/warn summary
- `DqdCategoryPanel` — Expandable accordion with check list table
- `DqdTableGrid` — Table × category heatmap colored by pass rate
- `DqdCheckDetail` — Single check detail with violation bar

**Other Components:**
- `SourceSelector` — Source picker dropdown
- `ConceptDrilldownPanel` — Per-concept detail (gender split, temporal trend, type distribution)

**Pages (5):**
- `DataExplorerPage` — Main page with source selector + 4 tabs (Overview/Domains/Data Quality/Temporal)
- `OverviewTab` — Record counts, demographics pyramid, gender pie, observation period box plot
- `DomainTab` — Sub-tabs per domain, top concepts bar, temporal trends, concept drilldown
- `DqdTab` — DQD scorecard, table grid, category panels, run history, dispatch button
- `TemporalTab` — Multi-domain temporal overlay with domain toggles

**Router:** Replaced `data-explorer` placeholder with lazy-loaded nested routes supporting `/data-explorer` and `/data-explorer/:sourceId`.

---

## File Summary

| Category | New | Modified |
|----------|-----|----------|
| Backend migrations | 5 | 0 |
| Backend models | 6 | 0 |
| Backend contracts | 2 | 0 |
| Backend services | 5 | 0 |
| Backend controllers | 2 | 0 |
| Backend jobs | 2 | 0 |
| Backend commands | 2 | 0 |
| Backend providers | 1 | 0 |
| Backend analysis classes | 46 | 0 |
| Backend DQD check classes | 10 (+ 3 factories) | 0 |
| Backend config | 0 | 3 (database, horizon, phpstan) |
| Backend routes | 0 | 1 (api.php) |
| Backend .env | 0 | 1 |
| Backend tests | 4 | 0 |
| Frontend types | 1 | 0 |
| Frontend pages | 5 | 0 |
| Frontend components | 12 | 0 |
| Frontend API | 2 | 0 |
| Frontend hooks | 1 | 0 |
| Frontend router | 0 | 1 |
| Frontend tests | 3 | 0 |

---

## Verification Results

| Check | Result |
|-------|--------|
| Pint (code style) | Pass |
| PHPStan (static analysis, level 6) | 0 errors |
| TypeScript (tsc --noEmit) | 0 errors |
| Pest unit tests | 62/62 pass (645 assertions) |
| Vitest (frontend) | 44/44 pass |

---

## Architecture Decisions

1. **Read-first strategy** — Step 4A reads existing Achilles results for immediate value. The engine (4B) adds the ability to recompute fresh analyses. This means the Data Explorer works immediately against the pre-computed 1.8M result rows.

2. **Writable ResultsModel** — Unlike CdmModel (read-only), ResultsModel allows writes because the Achilles engine needs to INSERT results and the DQD engine stores run data.

3. **Analysis interface pattern** — Each Achilles analysis is a self-contained class implementing `AchillesAnalysisInterface`. SQL templates use `{@cdmSchema}` and `{@resultsSchema}` placeholders rendered by SqlRendererService. This enables multi-dialect support.

4. **DQD factory pattern** — DQD checks use factory classes (`CompletenessCheckFactory`, `ConformanceCheckFactory`, `PlausibilityCheckFactory`) that programmatically generate check instances. This avoids hundreds of near-identical check files while maintaining the `DqdCheckInterface` contract.

5. **Bigint row counts** — DQD results use `unsignedBigInteger` for violated_rows and total_rows to handle the 711M+ measurement table without overflow.

6. **Separate achilles queue** — Long-running Achilles/DQD jobs run on a dedicated `achilles` Horizon supervisor (memory 1024MB, timeout 3600s) to avoid blocking ingestion jobs.

7. **Source-scoped endpoints** — All Achilles and DQD endpoints are scoped under `/v1/sources/{source}/` to support multiple CDM sources with independent characterization.

8. **Dark clinical chart theme** — All recharts and SVG visualizations use the DESIGNLOG.md color system: transparent backgrounds, teal (#2DD4BF) primary series, gold (#C9A227) accents, #F0EDE8 axis text, #323238 grid lines.

---

## Pipeline Flow

```
Existing Results → Achilles Reader → API Endpoints → Data Explorer UI
                                                      ├── Overview (record counts, demographics, obs periods)
CDM Data → Achilles Engine → Results Schema →         ├── Domains (top concepts, drilldowns, temporal)
                                                      ├── Data Quality (DQD scorecard, checks, heatmap)
CDM Data → DQD Engine → App DB (dqd_results) →       └── Temporal (multi-domain overlays)
```
