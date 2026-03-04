# Phase 14 — CDM Source Characterization Dashboard

**Date:** 2026-03-03
**Branch:** main

---

## Summary

Rewrote the Data Explorer Overview tab from a basic 4-widget display into a comprehensive 6-section CDM characterization dashboard following biostatistics visualization best practices. The new dashboard surfaces all Achilles characterization data that was previously returned by the API but never rendered (race, ethnicity, year of birth, observation start/end distributions, periods per person). Added 11 new chart components and exceeds OHDSI Atlas functionality in every category.

---

## What Was Built

### Section 1: Executive Summary
- 4 enhanced metric cards with sparkline trends (Persons, Median Obs Duration, Total Events, Data Completeness)
- Data completeness score (% of CDM tables with data)
- Person count sparkline derived from observation period start dates aggregated by year

### Section 2: Population Demographics
- **Gender**: Proportional stacked bar (replaces pie chart — biostat best practice: humans perceive length > angle)
- **Age × Gender**: Kept existing population pyramid (correct chart type)
- **Race**: Horizontal bar chart, sorted by count descending, top 10
- **Ethnicity**: Proportional stacked bar (typically 2-3 categories)
- **Year of Birth**: Histogram with smoothed density overlay (3-point moving average in gold)

### Section 3: Observation Period Analysis
- **Cumulative Observation Curve**: Kaplan-Meier style step function from box plot percentiles (p10→90%, p25→75%, median→50%, etc.)
- **Start/End Distribution**: Dual area chart showing observation start dates (teal) vs end dates (gold) over calendar time
- **Duration Box Plot**: Kept existing box plot (min, p10, p25, median, p75, p90, max)
- **Periods per Person**: Horizontal bar chart showing distribution (1 period, 2, 3, ..., 6+)

### Section 4: Domain Record Proportions
- **Treemap**: Recharts treemap sized by record count, colored by domain palette, clickable → navigates to Domains tab
- Summary table below with exact counts (treemaps sacrifice precision for overview)

### Section 5: Data Density Heatmap
- **Matrix**: 6 domain rows × year columns, cell color intensity = record volume
- D3 `scaleSequential` with viridis colormap for the first use of D3 in the codebase
- Data from 6 parallel `/temporal-trends` API calls (one per domain)
- Hover tooltip shows domain, year, and formatted record count

### Section 6: Record Distribution (Log Scale)
- **Log-scale bar chart**: Replaces linear RecordCountsPanel — all CDM tables visible regardless of magnitude
- Power-of-10 reference lines (1K, 10K, 100K, 1M, 10M, 100M)
- Domain-colored bars

---

## New Files (11 chart components)

| File | Purpose |
|------|---------|
| `charts/chartUtils.tsx` | Shared utilities, colors, theme, ChartCard wrapper |
| `charts/Sparkline.tsx` | Inline SVG mini line chart for metric cards |
| `charts/ProportionalBar.tsx` | Horizontal stacked bar for proportions |
| `charts/YearOfBirthHistogram.tsx` | ComposedChart: Bar + smoothed Area |
| `charts/CumulativeObservationCurve.tsx` | KM-style step function from percentile data |
| `charts/DualAreaChart.tsx` | Dual overlapping area chart |
| `charts/PeriodCountBar.tsx` | Horizontal bar for periods per person |
| `charts/DomainTreemap.tsx` | Recharts treemap with custom renderer |
| `charts/HeatmapChart.tsx` | SVG heatmap with D3 color scale |
| `charts/LogScaleBar.tsx` | Horizontal bar with logarithmic X axis |

All in `frontend/src/features/data-explorer/components/charts/`.

## Modified Files (3)

| File | Changes |
|------|---------|
| `pages/OverviewTab.tsx` | Complete rewrite — 6-section dashboard |
| `pages/DataExplorerPage.tsx` | Added cross-tab navigation callback |
| `hooks/useAchillesData.ts` | Added `useAllDomainTrends` hook (parallel domain queries via `useQueries`) |

---

## Biostatistics Best Practices Applied

1. **No pie charts** — replaced gender donut with proportional stacked bar
2. **Log scale** for record counts spanning 6 orders of magnitude
3. **Kaplan-Meier style** cumulative observation curve from percentile data
4. **Population pyramid** retained (correct for age×gender)
5. **Dual area chart** for temporal distributions
6. **Treemap** for hierarchical proportional data
7. **Heatmap** for matrix data (domain × time)
8. **Sparklines** for inline trend indicators
9. **Colorblind-safe palette** (Okabe-Ito inspired)
10. **Progressive loading** — each section renders independently

---

## What This Exceeds Over Atlas

| Feature | Atlas | Parthenon |
|---------|-------|-----------|
| Gender display | Pie chart | Proportional bar |
| Race/Ethnicity | Not shown | Bar + proportional bar |
| Year of birth | Not shown | Histogram + density |
| Record counts scale | Linear | Log scale |
| Observation analysis | Single cumulative chart | KM curve + dual area + box plot + periods/person |
| Domain proportions | Basic table | Interactive treemap |
| Data density | Not available | Domain × time heatmap |
| Sparklines | No | Inline trends |
| Completeness score | No | Percentage in header |
| Progressive loading | No | Per-section shimmer |
| Cross-tab navigation | No | Click domain → Domains tab |

---

## Verification

- TypeScript: `npx tsc --noEmit` → 0 errors
- Tests: 11 files, 64 tests passed
- Build: `npx vite build` → success (2.52s)
- Zero new dependencies (uses existing recharts, d3-scale, d3-scale-chromatic)
- Zero backend changes

---

## Key Decisions

1. **No new backend endpoints**: All data was already returned by existing endpoints but never rendered. The heatmap uses 6 parallel temporal-trends calls.

2. **D3 for color only**: D3 is used only for `scaleSequential` + `interpolateViridis` in the heatmap. All rendering is React SVG, not D3 DOM manipulation.

3. **Derived domain treemap**: Instead of needing a new backend endpoint, treemap data is derived from existing record counts by mapping CDM table names → clinical domain names.

4. **File extension**: `chartUtils.tsx` (not `.ts`) because it exports a JSX component (`ChartCard`). esbuild requires `.tsx` for files with JSX.

---

## Post-Phase 14: Speed Optimization & Fixes (2026-03-04)

### Login-to-Dashboard Speed Optimization (commit `9dfd3c9a`)
Reduced login-to-dashboard time from multi-second waterfall to **~250ms click-to-visible**.

5 optimizations:
1. **CSRF prefetch on mount** — `LoginPage` fires `/sanctum/csrf-cookie` on component mount, eliminating a blocking round-trip at submit time
2. **Unified `/api/v1/dashboard/stats` endpoint** — new `DashboardController` replaces 3+N sequential frontend API calls with 1 backend query
3. **Deferred `last_login_at` update** — `dispatch()->afterResponse()` moves the write out of the critical path
4. **Eager-load `roles.permissions`** in login query — eliminates N+1 queries
5. **Dashboard data prefetch** — `queryClient.prefetchQuery` starts loading before React Router navigation completes

Verified with Playwright headless test: 250-320ms click-to-dashboard consistently.

### DashboardController Column Fix (commit `a6fbb92f`)
The `DashboardController.stats()` method selected `status` and `person_count` columns from `cohort_definitions` — columns that don't exist. Fixed to use `tags`. Also fixed log file permissions that were masking the real error.

### Docker Desktop Reliability Issue
Docker Desktop socket proxy (`~/.docker/desktop/docker.sock`) intermittently returns 500 errors. Workaround: `DOCKER_HOST=unix:///var/run/docker.sock` to use the real Docker engine directly. Also changed `REDIS_HOST` from `host.docker.internal` to `redis` for container networking compatibility.

### Achilles Analysis ID Fix (2026-03-04)

**Critical bug:** The `AchillesResultReaderService` had 4 wrong OHDSI Achilles analysis IDs, causing the Overview dashboard to display incorrect or missing data.

| Field | Wrong Analysis | Correct Analysis | Symptom |
|-------|---------------|-----------------|---------|
| Year of Birth | 4 (race) | **3** | Showed race concept IDs as years |
| Race | 10 (YoB×gender) | **4** | Showed YoB×gender data as race |
| Age Pyramid | 3 (YoB) | **10** (YoB×gender → age deciles) | "No age distribution data" |
| Obs Duration | 109 (continuous obs/year) | **105** (duration dist) | Median = 0 days |

**Root cause:** Analysis IDs were assumed from memory rather than verified against the `achilles_analysis` table. The OHDSI Achilles spec defines analysis 3 as "year of birth" and 4 as "race" — the code had them swapped.

**Fixes applied:**
- Backend: Corrected all 4 analysis IDs, added `RACE_CONCEPTS` constant for well-known IDs, compute real age decile pyramid from analysis 10 (year_of_birth × gender → age buckets with male/female split)
- Frontend: Updated `AgeDistribution` type to `{age_decile, male, female}` (was `{age_decile, count}`), `DemographicsPyramid` now uses real gender counts instead of dividing total by 2
- Added `unwrap()` helper to all `achillesApi.ts` functions to handle Laravel's `{data: T}` response envelope

**Result:**
- Age pyramid renders correctly with real male/female breakdown across all deciles (0-9 through 90+)
- Race shows "White" (834.7K), "Black or African American" (115.2K), "Asian" (33.8K)
- Median obs duration: 11,179 days (was 0)
- Year of birth: correct years (1914-2026)

**Lesson learned:** Never assume OHDSI analysis IDs — always verify against the `achilles_analysis` table. Memory file written to prevent recurrence.

---

## Eunomia Dataset, Multi-Source Achilles & Dashboard CDM Summary (2026-03-04)

Added the OHDSI Eunomia GiBleed synthetic dataset as a second data source alongside the existing OHDSI Acumenus (1M patients). Built multi-source Achilles support via dynamic PostgreSQL schema switching. Added a CDM characterization summary section to the main Dashboard with a source selector dropdown.

### Eunomia Dataset Loader (`parthenon:load-eunomia`)

**New file:** `backend/app/Console/Commands/LoadEunomiaCommand.php`

An artisan command that:
1. Downloads `GiBleed_5.3.zip` from the OHDSI EunomiaDatasets GitHub repo (or accepts `--path` for local zip)
2. Creates `eunomia` schema and loads 20 CDM tables (343,279 rows total) from CSV files
3. Creates `eunomia_results` schema with Achilles result tables
4. Runs **mini-Achilles SQL** — 20+ analysis groups computed via direct PostgreSQL queries (no R dependency):
   - Demographics: analyses 0, 2, 3, 4, 5, 10
   - Observation periods: analyses 101, 103, 105, 108, 109, 111, 113
   - Domain record counts: analyses 200, 400, 600, 700, 800, 1800
   - Monthly trends, type distributions, gender distributions per domain
5. Seeds "Eunomia (Demo)" source with 3 daimons: CDM→eunomia, Vocab→omop (shared), Results→eunomia_results

**Result:** 2,694 patients, 64,476 Achilles result rows, 2 distribution rows.

### Multi-Source Achilles Support

**Modified:** `backend/app/Services/Achilles/AchillesResultReaderService.php`

Added `setSchemaForSource(Source $source)` method that dynamically sets `search_path` on the `results` DB connection based on the source's results daimon `table_qualifier`. Called at the start of every public method. Three methods that previously lacked a `$source` parameter (`getDistribution`, `getAvailableAnalyses`, `getPerformanceReport`) were updated.

**Modified:** `backend/app/Http/Controllers/Api/V1/AchillesController.php` — passes `$source` to the updated methods.

### Dashboard CDM Characterization Summary

**Modified:** `frontend/src/features/dashboard/pages/DashboardPage.tsx`

New section between the metric row and two-column panels:
- **Source selector dropdown** — reuses existing `SourceSelector` component
- **4 CDM metric cards** — Persons (with sparkline), Median Obs Duration, Total Events, Data Completeness
- **Gender proportional bar** — reuses `ProportionalBar` chart
- **Age pyramid** — compact height (220px), reuses `DemographicsPyramid`
- **"View Full Characterization →"** link to Data Explorer
- **Auto-selects first source** — beginners see CDM data immediately

**Modified:** `frontend/src/features/data-explorer/components/charts/DemographicsPyramid.tsx` — added optional `height` prop (default 320).

### Docker Build Fix

**Modified:** `docker/node/Dockerfile` — added `--legacy-peer-deps` to `npm ci` and `npm install` for react-joyride React 19 compatibility.

### Key Technical Decisions

- **CSV-to-PostgreSQL Text Format Preprocessing**: Eunomia CSVs use comma-delimited format with quoted empty strings for nullable fields. PostgreSQL's `pgsqlCopyFromFile` uses text format (tab-delimited). Solution: preprocess with `fgetcsv()` to parse CSV properly, convert empty fields to `__EUNOMIA_NULL__` unique marker, output tab-delimited text.
- **Mini-Achilles via SQL (No R Dependency)**: Instead of requiring R/HADES to run full Achilles, the loader computes the ~20 key analyses needed for the dashboard directly via PostgreSQL SQL. Keeps installation beginner-friendly.
- **Shared Vocabulary**: Eunomia's bundled vocabulary CSVs (tiny subset) are skipped. The source's vocab daimon points to the existing `omop` schema with the full 7.2M concept vocabulary.
- **Schema Switching (Not Model Switching)**: Rather than creating separate model classes per source, we use `SET search_path` on the existing `results` connection. Stateless per-request, no Eloquent changes needed.

### Verification

- Eunomia source: `curl /api/v1/sources` returns both "OHDSI Acumenus" (id=6) and "Eunomia (Demo)" (id=7)
- Multi-source: Acumenus returns 1,005,787 persons; Eunomia returns 2,694 persons
- TypeScript: `npx tsc --noEmit` → 0 errors
- Vite build (local + Docker): success

| Source | Persons | Achilles Rows | Distribution Rows |
|--------|---------|---------------|-------------------|
| OHDSI Acumenus | 1,005,787 | 1.8M | Many |
| Eunomia (Demo) | 2,694 | 64,476 | 2 |

---

## Admin Pages: React Error Fix + UI Consistency (2026-03-04)

### React Error Fix
The `/admin/users` page (and any page rendering user roles) crashed with "Objects are not valid as a React child (found: object with keys {id, name, guard_name, created_at, updated_at, pivot})".

**Root cause:** `UserController::index()` used `User::with('roles')` which eager-loads full Spatie Role model objects, but frontend `User` type expects `roles: string[]`. The `AuthController` already correctly used `$user->getRoleNames()`.

**Fix:** Added `formatUser()` helper to UserController that transforms roles to string names via `getRoleNames()`. Applied to all 4 user-returning methods (index, store, update, syncRoles).

### UI Consistency Overhaul
Rewrote all 6 admin pages + UserModal to use the shared UI component library (Panel, MetricCard, Badge, Modal, DataTable, TabBar, Button, SearchBar, StatusDot) instead of raw tailwind divs. Now visually consistent with Dashboard and Data Explorer pages.

**Files changed:** UserController.php, AdminDashboardPage.tsx, UsersPage.tsx, UserModal.tsx, RolesPage.tsx, SystemHealthPage.tsx, AiProvidersPage.tsx, AuthProvidersPage.tsx
