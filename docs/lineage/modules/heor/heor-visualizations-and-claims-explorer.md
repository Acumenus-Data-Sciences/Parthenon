# HEOR Visualizations & Claims Explorer

**Date:** 2026-03-09
**Branch:** `feature/analysis-viz-improvements`

## What Was Built

### 1. HEOR Analysis Visualization Charts (4 components)

Added 4 interactive data visualization charts to the HEOR analysis detail page, rendered in a 2x2 grid above the per-scenario result cards.

| Chart | Implementation | Data Source |
|-------|---------------|-------------|
| Cost-Effectiveness Plane | Custom SVG scatter plot | `incremental_cost`, `incremental_qalys`, `icer`, `nmb` |
| Tornado Diagram | Recharts horizontal BarChart | `tornado_data[]` (top 10 parameters by ICER range) |
| Budget Impact Trajectory | Recharts AreaChart | `budget_impact_year1/3/5` (5-year projection with interpolation) |
| Scenario Comparison | Recharts grouped BarChart | `total_cost`, `total_qalys` across all scenarios |

**Cost-Effectiveness Plane features:**
- 4-quadrant layout (Dominant/Dominated/Trade-off) with tinted fills
- WTP threshold line ($50K/QALY default, configurable)
- Per-scenario scatter points with ICER and NMB labels
- Dynamic axis scaling with nice tick generation
- Colorblind-safe palette (Okabe-Ito inspired)

**Tornado Diagram features:**
- Horizontal bars showing ICER range per parameter variation (±20% or bounds)
- Color-coded by parameter type (drug_cost=gold, hospitalization=crimson, qaly_weight=teal, etc.)
- Base ICER reference line with dashed gold stroke
- Rich tooltips: base value, range, low/high ICER values
- Top 10 parameters sorted by impact magnitude

**Budget Impact Trajectory features:**
- 5-year AreaChart with gradient fills per scenario
- Years 2 and 4 interpolated linearly between known data points (1, 3, 5)
- Multi-scenario overlay with distinct colors
- Dot markers at each data point

**Scenario Comparison features:**
- Side-by-side bar charts: Total Cost (gold) and Total QALYs (teal)
- Base case scenarios rendered with muted opacity
- Summary row below with per-scenario cost/QALY badges

### 2. Claims Explorer (HEOR Tab)

Added a "Claims Explorer" tab to the HEOR page — the third tab alongside "Economic Analyses" and "Value Contracts". This puts claims cost data directly alongside economic modeling, enabling analysts to validate HEOR cost parameters against real claim charges.

**Frontend components:**
- `ClaimsExplorer.tsx` — Full search UI with facets, stats, pagination
- `claimsApi.ts` — Typed API client for `GET /api/v1/claims/search`
- `useClaims.ts` — TanStack Query hook with `keepPreviousData`

**Features:**
- Full-text search (eDisMax: patient_name^3, diagnosis^2, line_notes, procedure_codes)
- 4 financial stats cards: Total Charges, Avg Charge, Total Payments, Outstanding
- Faceted sidebar: Status, Claim Type, Place of Service, Diagnosis (click-to-filter, click-to-clear)
- 9-column results table: Patient, Date, Type, Status, Diagnosis, Charge, Payment, Outstanding, Txns
- Pagination (25/page) with page navigation
- "Solr-accelerated" badge when Solr engine is active
- Graceful fallback when Solr core is unavailable

**Solr indexing:**
- Ran `php artisan solr:index-claims --schema=omop` — 48K+ claims indexed (19 MB index)
- Full 26.3M claims can be indexed with unlimited run (~15 min)

## Files Changed

### New Files (7)
- `frontend/src/features/heor/components/CostEffectivenessPlane.tsx` — Custom SVG CE plane
- `frontend/src/features/heor/components/TornadoDiagram.tsx` — Recharts tornado chart
- `frontend/src/features/heor/components/BudgetImpactChart.tsx` — Recharts area chart
- `frontend/src/features/heor/components/ScenarioComparisonChart.tsx` — Recharts bar charts
- `frontend/src/features/heor/components/ClaimsExplorer.tsx` — Claims search UI
- `frontend/src/features/heor/api/claimsApi.ts` — Claims API client + types
- `frontend/src/features/heor/hooks/useClaims.ts` — TanStack Query hook

### Modified Files (2)
- `frontend/src/features/heor/pages/HeorAnalysisPage.tsx` — Import + render 4 chart components in Results section
- `frontend/src/features/heor/pages/HeorPage.tsx` — Add "Claims Explorer" tab + import ClaimsExplorer component

## Architecture Decisions

- **CE Plane is custom SVG** — Recharts scatter doesn't support quadrant fills, WTP threshold lines, or per-point labels with enough control. SVG gives pixel-perfect placement.
- **Tornado uses stacked Bar trick** — First (transparent) bar positions the visible bar at the correct X offset; second bar renders the colored range. This creates bidirectional appearance.
- **Budget Impact interpolates Years 2 & 4** — Backend only computes Year 1/3/5; linear midpoints fill the gaps for a smooth 5-point area chart.
- **Claims Explorer lives in HEOR, not standalone** — HEOR analysts need claims data to validate cost parameters. Keeping it in the same section creates a natural research-to-modeling workflow.
- **Solr-powered, not PostgreSQL** — 26.3M claims with faceted search + financial aggregation would be slow in PG. Solr handles this in <50ms with precomputed facets and stats.

## Key Patterns

- All charts use `CHART` color constants from `chartUtils.tsx` for theme consistency
- `ChartCard` wrapper for consistent padding, title, and subtitle styling
- `TOOLTIP_CLS` for dark-themed Recharts custom tooltip containers
- `formatCompact()` for large number display ($1.0M, $2.5K)
- `keepPreviousData` in TanStack Query prevents layout shift during pagination
