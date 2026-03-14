# Drillable Summary Cards — Platform-Wide UX Enhancement

**Date:** 2026-03-12
**Scope:** 13 frontend files across 10 feature areas

## Problem

Summary boxes / metric cards across the platform were purely informational — users could see counts and KPIs but had no way to click through to the underlying data. This made the dashboard and list pages feel static and required extra navigation steps.

## Solution

Added drill-down navigation to every summary card, stats bar, and metric display across the entire platform. Cards now act as navigation shortcuts to the data they summarize.

## Changes by Area

### 1. Shared UI — `MetricCard` Component
- Added optional `to` prop that wraps the card in a React Router `<Link>`
- Adds `cursor-pointer` class and hover border highlight when linkable

### 2. Main Dashboard (`DashboardPage.tsx`)
| Card | Navigates To |
|------|-------------|
| CDM Sources | `/data-sources` |
| Active Cohorts | `/cohort-definitions` |
| Running Jobs | `/jobs` |
| DQD Failures | `/data-explorer` |
| Concept Sets | `/concept-sets` |
| CDM Characterization cards (4) | `/data-explorer/:sourceId` |
| Source Health table rows | `/data-explorer/:sourceId` |
| Recent Cohort Activity rows | `/cohort-definitions/:id` |

### 3. Admin Dashboard (`AdminDashboardPage.tsx`)
| Card | Navigates To |
|------|-------------|
| Total Users | `/admin/users` |
| Roles Defined | `/admin/roles` |
| Auth Providers | `/admin/auth-providers` |
| Active AI | `/admin/ai-providers` |

### 4. Analysis Stats Bar (`AnalysisStatsBar.tsx`)
- Added `onStatClick` callback prop with analysis type key
- All 8 stat chips (Characterizations → Total) now clickable with hover effects

### 5. Cohort Stats Bar (`CohortStatsBar.tsx`)
- Added `onStatClick` callback — Total, Generated, Public all clickable

### 6. Concept Set Stats Bar (`ConceptSetStatsBar.tsx`)
- Added `onStatClick` callback — Total, With Items, Public all clickable

### 7. FHIR Sync Dashboard (`FhirSyncDashboardPage.tsx`)
- All 6 MetricCards (Connections, Total Runs, Completed, Failed, Records Written, Avg Coverage) link to `/admin/fhir-connections`

### 8. Data Explorer Overview (`OverviewTab.tsx`)
- 4 metric cards (Persons, Median Obs, Total Events, Completeness) trigger `onNavigateToDomain` to switch to Domains tab

### 9. Phenotype Library (`PhenotypeLibraryPage.tsx`)
- 4 StatCards (Total, With Expression, Domains, Imported) clear filters and reset to page 1

### 10. Genomics (`GenomicsPage.tsx`)
- "Total Variants" card clears all filters
- "Pathogenic / LP" card activates the P/LP filter toggle

### 11. Ingestion Review (`ReviewStatsBar.tsx`)
- Legend segment items now clickable via `onSegmentClick` callback

### 12. Care Gaps (`PopulationComplianceDashboard.tsx`)
- SummaryCards (Total Bundles, Total Patients, Total Open Gaps) reset category filter to "All"

## Accessibility

Every clickable card includes:
- `role="button"` for screen readers
- `tabIndex={0}` for keyboard focus
- `onKeyDown` handler for Enter/Space activation
- `cursor: pointer` styling
- Hover border highlight (`border-[#3A3A40]`)

## Gotchas

- The `AnalysisStatsBar` component is exported but only its `useAnalysisStats` hook is consumed by `AnalysesPage` (the page uses inline tabs instead). The `onStatClick` prop is available for future use if the stats bar is rendered elsewhere.
- `ReviewStatsBar` is a progress visualization — the `onSegmentClick` callback is wired but the parent `MappingReviewPage` doesn't yet have a filter mechanism to connect it to.
- Verdict dashboard cards (Estimation, Prediction, SCCS, etc.) were intentionally left display-only — they show analysis results, not navigable aggregates.
