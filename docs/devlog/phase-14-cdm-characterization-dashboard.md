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
