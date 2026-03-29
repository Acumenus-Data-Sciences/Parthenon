# Risk Scores v2 — Frontend Design Specification

**Date:** 2026-03-29
**Status:** Approved
**Supersedes:** `2026-03-28-risk-scores-frontend-design.md` (v1 catalogue UI)
**Depends on:** `2026-03-28-risk-scores-v2-design.md` (v2 backend architecture)

## Summary

Rebuild the Risk Scores frontend from a static catalogue into a Studies-mirror analysis hub. The page centers on Risk Score Analyses as the primary operational entity, with the 20-score catalogue embedded in the creation wizard. Supports cohort-scoped execution, recommendation-driven score selection, patient-level results with drill-through, and inline cohort creation from risk tiers.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page architecture | Studies-mirror hub | Analyses are the primary entity; catalogue lives in wizard and detail page |
| Creation wizard | 2-step compact | Cohort + score selection belong together (recommendations depend on cohort); review gate before execution |
| Detail page | Tabbed with smart Overview default | Consistent with Studies; 5 tabs appropriate for simpler entity |
| Cohort derivation | Inline "Create Cohort" buttons + future builder integration | Immediate value from tier-based cohort creation; builder integration spec'd for Phase 3 |
| v1/v2 coexistence | v2 UX with v1 fallback | Uniform experience; unmigrated scores silently use v1 engine |

## Routes

| Route | Page | Component |
|-------|------|-----------|
| `/risk-scores` | Hub (analyses list) | `RiskScoreHubPage.tsx` |
| `/risk-scores/create` | Creation wizard | `RiskScoreCreatePage.tsx` |
| `/risk-scores/:id` | Analysis detail (5 tabs) | `RiskScoreDetailPage.tsx` |

Navigation stays in the Evidence group at the same position.

## Page 1: Hub (`/risk-scores`)

Mirrors `StudiesPage.tsx` exactly.

### Header

- Title: "Risk Score Analyses"
- Subtitle: "Stratify patient populations by validated clinical risk scores"
- Right side: view toggle (table/card, localStorage-persisted), search dropdown (debounced, autocomplete from all analyses), "New Analysis" button (crimson `btn btn-primary`)

### Stats Bar

5 clickable metric cards (same component pattern as Studies):

| Metric | Icon | Color | Drilldown Filter |
|--------|------|-------|------------------|
| Total Analyses | Briefcase | `#C5C0B8` | None (resets drilldown) |
| Running | Loader2 | `#F59E0B` | Status = running |
| Completed | Shield | `#2DD4BF` | Status = completed |
| Scores Available | Activity | `#60A5FA` | None (static count: 20) |
| Patients Scored | Users | `#A78BFA` | None (aggregate) |

Clicking a metric card opens the drilldown panel (expandable list of matching analyses, same as Studies phase drilldown). Click again or X to close.

### Filter Chips

Three filter dimensions with facet counts from backend:

- **Category:** Cardiovascular, Hepatic, Comorbidity Burden, Pulmonary, Metabolic, Musculoskeletal (filters by scores included in the analysis)
- **Status:** Draft, Running, Completed, Failed
- **Cohort:** Dropdown of cohort names that have been analyzed

"Clear" button resets all filters.

### Table View

Sortable columns:

| Column | Sortable | Format |
|--------|----------|--------|
| Name | Yes | Text, clickable → detail page |
| Cohort | Yes | Badge with patient count |
| Scores | No | Count + category dots (colored) |
| Status | Yes | Colored badge (Draft=gray, Running=amber, Completed=teal, Failed=red) |
| Patients Scored | Yes | Number |
| Avg Completeness | Yes | Percentage |
| Last Run | Yes | Relative timestamp |
| Author | No | Name |

Pagination: server-side, 20 per page, "Showing X-Y of Z" footer.

### Card View

3-column responsive grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`). Each card:

- Analysis name (line-clamped to 2 lines)
- Cohort badge + patient count
- Score count with category color dots
- Mini stacked bar showing aggregate tier distribution across all scores
- Status badge + last run timestamp
- Author name in footer

Entire card clickable → detail page.

### Empty State

Icon (Activity, 28px, muted), "No risk score analyses yet", "Create your first analysis to stratify patient populations by clinical risk.", "New Analysis" button.

## Page 2: Creation Wizard (`/risk-scores/create`)

2-step compact wizard with step indicator progress bar.

### Step 1: Configure

**Basics section:**
- Name input — auto-suggested based on cohort selection (e.g., "PDAC Patients — Risk Stratification"), editable
- Description textarea — optional
- Target Cohort dropdown — lists cohort definitions for the active source, shows patient count per cohort. Selecting triggers `POST /sources/{source}/risk-score-analyses/{analysis}/recommend` with the cohort ID.

**Score Selection section (appears after cohort selection):**

Loading state: skeleton cards while `/recommend` runs.

**Cohort Profile Panel** (once loaded):
- Patient count, age range (min–max), gender split (% male / % female)
- Top 5 conditions with horizontal prevalence bars
- Measurement coverage indicators (percentage bars per measurement type)

**Score Recommendation Cards** — grouped in 3 tiers:

1. **Recommended** (border: `#2DD4BF` at 40% opacity, background: `#2DD4BF` at 5%)
   - Pre-checked checkbox
   - Score name + category badge
   - Relevance reason (from recommendation engine)
   - Expected completeness bar
   - Sorted by relevance (high → medium)

2. **Available** (border: `#F59E0B` at 40% opacity, background: `#F59E0B` at 5%)
   - Unchecked checkbox
   - Same card layout
   - Lower relevance reason

3. **Not Applicable** (border: `#323238`, background: `#151518`, opacity: 0.6)
   - No checkbox
   - Score name + reason for inapplicability
   - Cannot be selected

**Shortcuts:**
- "Select All Recommended" button
- "Select All Available" button
- Individual checkboxes per card

**Validation:** At least one score must be selected. Cohort is required.

### Step 2: Review & Run

**Summary panels:**
- Analysis name + description
- Target cohort: name + patient count badge
- Selected scores: listed with category badges and expected completeness
- Total estimated patients

**Two action buttons:**
- "Create as Draft" (`btn btn-ghost`) — saves analysis, navigates to hub
- "Create & Run" (`btn btn-primary`, crimson) — saves + dispatches execution, opens run modal

### Run Modal

Adapts existing `RiskScoreRunModal.tsx` for v2 execution:
- Header: "Running Risk Score Analysis" + animated activity icon
- Progress bar with percentage (gold-to-teal gradient)
- Stats badges: X completed, X failed, X pending, elapsed time
- Score rows grouped by category (collapsible):
  - Status icon (pending=gray clock, running=gold spinner, completed=green check, failed=red alert)
  - Score ID + name
  - Elapsed timer
  - Failed rows: expandable error detail (monospace)
- Auto-collapse completed categories
- On completion: "View Results" button → navigates to `/risk-scores/:id`

## Page 3: Analysis Detail (`/risk-scores/:id`)

### Header

- Back button → `/risk-scores`
- Editable title (click to edit, Enter to save, Escape to cancel)
- Status badge (colored, clickable for allowed transitions)
- Cohort badge: cohort name + patient count
- Action buttons: Re-run (crimson), Duplicate, Export JSON, Delete (danger, confirmation required)

### Tab Bar

5 tabs with icons:

| Tab | Icon | Badge |
|-----|------|-------|
| Overview | LayoutDashboard | — |
| Results | BarChart3 | Score count |
| Patients | Users | Patient count |
| Recommendations | Sparkles | — |
| Configuration | Settings | — |

### Tab 1: Overview (default)

**Layout: 2-column (2/3 + 1/3)**

**Left column:**
- **About** — description, author, created/updated dates
- **Smart Results Summary:**
  - If results exist: 4 stat cards (Scores Computed, Patients Scored, Avg Completeness, Avg Confidence) + per-score mini cards showing score name + mini stacked tier bar. Each mini card clickable → Results tab filtered to that score. Prominent "View Full Results →" link.
  - If no results (draft): "This analysis hasn't been executed yet." + "Run Analysis" CTA button (crimson)
  - If running: progress indicator with live status
- **Execution Timeline** — list of past executions: timestamp, duration, status badge, "View" link

**Right column:**
- **Cohort Profile** — patient count, age range, gender split, top conditions (compact version of wizard panel)
- **Selected Scores** — list with category badges
- **Author** — name, email

### Tab 2: Results

**Score filter** — horizontal pill buttons to filter by individual score (default: "All Scores"). Active pill highlighted in teal.

**Per-score result cards** (one per computed score, collapsible):
- **Card header:** score name + category badge + description
- **Stacked bar chart** — horizontal tier distribution using `TierBreakdownChart`
- **Tier table:**

| Tier | Count | % of Eligible | Mean Score | Confidence | Action |
|------|-------|---------------|------------|------------|--------|
| Low | 180 | 50% | 1.2 | 0.95 | **Create Cohort** (teal icon button) |
| Intermediate | 100 | 28% | 3.4 | 0.88 | **Create Cohort** |
| High | 60 | 17% | 5.8 | 0.82 | **Create Cohort** |
| Very High | 21 | 6% | 8.1 | 0.79 | **Create Cohort** |

- **Completeness stat** + data gaps summary ("12 patients missing lipid panel")
- Clicking a tier row also filters the Patients tab to that tier

### Tab 3: Patients

**TanStack Table** — sortable, filterable, paginated (server-side, 50 per page).

**Columns:**

| Column | Sortable | Format |
|--------|----------|--------|
| Person ID | Yes | Monospace, clickable → Patient Profile |
| Score | Yes | Score name or ID |
| Score Value | Yes | Numeric (1 decimal) |
| Risk Tier | Yes | Colored badge |
| Confidence | Yes | Percentage |
| Completeness | Yes | Percentage |
| Missing Components | No | Comma-separated list or "—" |

**Filters toolbar:**
- Score dropdown (multi-select)
- Tier multi-select chips
- Completeness threshold slider (0–100%)

**Bulk actions toolbar** (appears when filters are active or rows are selected):
- "Create Cohort from Current Filter" (`btn btn-primary`) — creates cohort from all patients matching current filters
- "Export CSV" (`btn btn-ghost`)
- Shows count: "Showing X of Y patients"

**Row click** → navigates to `/profiles?source={sourceId}&person={personId}`

### Tab 4: Recommendations

Read-only view of the recommendation engine output at analysis creation time.

**Cohort Profile Panel** — full version (age range, gender split, condition prevalence bars, measurement coverage bars)

**Recommendation Cards** — same 3-tier layout as wizard (Recommended / Available / Not Applicable) with relevance reasons. Cards that were selected for the analysis have a checkmark overlay. Non-interactive (no checkboxes).

Purpose: audit trail — why were these scores chosen for this cohort?

### Tab 5: Configuration

**Design** — formatted read-only view of `design_json`:
- Target cohort IDs + names
- Selected score IDs + names
- Parameters (min completeness, patient-level storage flag)

**Execution History** — table:

| Execution | Status | Started | Duration | Scores | Patients | Actions |
|-----------|--------|---------|----------|--------|----------|---------|
| #3 | Completed | Mar 29, 2026 14:32 | 8.2s | 5/5 | 361 | View Results |
| #2 | Failed | Mar 29, 2026 14:10 | 3.1s | 2/5 | — | View Errors |
| #1 | Completed | Mar 28, 2026 09:15 | 7.8s | 5/5 | 361 | View Results |

**Re-run button** — dispatches new execution with same configuration, opens run modal.

## Cohort Creation from Risk Tiers

### Inline "Create Cohort" Modal

Triggered by:
- "Create Cohort" button on a tier row (Results tab)
- "Create Cohort from Current Filter" button (Patients tab)

**Modal contents:**
- Name input — auto-generated: `"{Score Name} — {Tier} Risk — {Cohort Name}"` (editable)
- Description textarea — auto-generated: `"Patients from cohort '{Cohort Name}' with {Score Name} risk tier = {Tier} (score {operator} {threshold})"` (editable)
- Source: read-only, locked to analysis source
- Patient count: read-only, shows how many patients will be in the cohort
- Derivation info (collapsible): analysis ID, execution ID, score ID, tier/filter criteria

**Actions:**
- "Create Cohort" (`btn btn-primary`) — creates the cohort definition + inserts patient IDs into `results.cohort`
- "Cancel" — closes modal

**Backend creates:**
- `CohortDefinition` with `expression_type: 'risk_score_derived'`
- `derivation_json`: `{ analysisId, executionId, scoreId, tier?, filterCriteria? }`
- Inserts matching `person_id`s into `results.cohort` with new `cohort_definition_id`

**Success:** toast notification with link to the new cohort definition.

### Future: Cohort Builder Integration (Phase 3, out of scope)

New criterion type "Risk Score" in the Cohort Definition builder:
- Score selector + operator (>=, <=, =, between) + value
- Tier selector (low, intermediate, high, very high)
- Composable with other inclusion/exclusion criteria

Documented here for completeness; not implemented in this v2 release.

## v1/v2 Engine Coexistence

The frontend presents a uniform v2 experience. Behind the scenes:

- Scores migrated to `PopulationRiskScoreV2Interface` (currently RS005 Charlson) use the v2 execution engine: cohort-scoped, patient-level results, vocab-validated concepts.
- Scores still on `PopulationRiskScoreInterface` (RS001-RS004, RS006-RS020) use a v1 compatibility adapter: the v2 execution service calls their `sqlTemplate()` method scoped to the cohort, then normalizes results into the v2 patient-level format.
- The frontend never knows which engine computed a score. Results are always in v2 format.
- As scores migrate to v2, results improve (validated concepts, true patient-level compute) with zero frontend changes.

## API Endpoints

### New Endpoints Required

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/risk-score-analyses` | Index with pagination, search, filters, facets |
| GET | `/api/v1/risk-score-analyses/stats` | Stats for hub bar (total, running, completed, patients scored) |
| PUT | `/api/v1/risk-score-analyses/{id}` | Update name/description |
| DELETE | `/api/v1/risk-score-analyses/{id}` | Soft delete |
| GET | `/api/v1/risk-score-analyses/{id}/executions/{executionId}/patients` | Patient-level results (paginated, filterable) |
| POST | `/api/v1/risk-score-analyses/{id}/create-cohort` | Create cohort from tier or filter criteria |

### Existing Endpoints (from v2 backend)

| Method | Endpoint | Status |
|--------|----------|--------|
| POST | `/api/v1/risk-score-analyses` | Exists (store) |
| GET | `/api/v1/risk-score-analyses/{id}` | Exists (show) |
| POST | `/api/v1/sources/{source}/risk-score-analyses/{id}/execute` | Exists |
| POST | `/api/v1/sources/{source}/risk-score-analyses/{id}/recommend` | Exists |
| GET | `/api/v1/risk-scores/catalogue` | Exists (v1, retained for reference) |

### Deprecated Endpoints

| Method | Endpoint | Replacement |
|--------|----------|-------------|
| POST | `/api/v1/sources/{source}/risk-scores/run` | Per-analysis execution |
| GET | `/api/v1/sources/{source}/risk-scores/eligibility` | `/recommend` endpoint |

## Frontend File Structure

```
frontend/src/features/risk-scores/
  ├── pages/
  │   ├── RiskScoreHubPage.tsx              — NEW (replaces RiskScoreCataloguePage)
  │   ├── RiskScoreCreatePage.tsx           — NEW (2-step wizard)
  │   └── RiskScoreDetailPage.tsx           — REWRITE (tabbed detail)
  ├── components/
  │   ├── RiskScoreAnalysisList.tsx         — NEW (sortable table view)
  │   ├── RiskScoreAnalysisCard.tsx         — NEW (card view)
  │   ├── RiskScoreRunModal.tsx             — KEEP (adapt for v2)
  │   ├── TierBreakdownChart.tsx            — KEEP
  │   ├── ScoreRecommendationCard.tsx       — NEW (3-tier recommendation cards)
  │   ├── CohortProfilePanel.tsx            — NEW (age, conditions, measurements)
  │   ├── PatientResultsTable.tsx           — NEW (TanStack, filters, bulk actions)
  │   ├── CreateCohortModal.tsx             — NEW (inline cohort from tier)
  │   ├── OverviewTab.tsx                   — NEW (smart overview with results summary)
  │   ├── ResultsTab.tsx                    — NEW (per-score tier cards)
  │   ├── PatientsTab.tsx                   — NEW (patient table + cohort creation)
  │   ├── RecommendationsTab.tsx            — NEW (read-only recommendation audit)
  │   └── ConfigurationTab.tsx              — NEW (design + execution history)
  ├── hooks/
  │   └── useRiskScores.ts                  — EXTEND (add v2 analysis hooks)
  ├── api/
  │   └── riskScoreApi.ts                   — EXTEND (add v2 API functions)
  └── types/
      └── riskScore.ts                      — EXTEND (add v2 interfaces)
```

### Files Removed

- `RiskScoreCataloguePage.tsx` — replaced by `RiskScoreHubPage.tsx`
- `RiskScoreCard.tsx` — replaced by `RiskScoreAnalysisCard.tsx` + `ScoreRecommendationCard.tsx`

### Files Kept

- `RiskScoreRunModal.tsx` — adapted for v2 execution tracking
- `TierBreakdownChart.tsx` — reused in Results tab

## Design System

All components follow Parthenon dark clinical theme:

| Element | Color | Usage |
|---------|-------|-------|
| Base | `#0E0E11` | Page background |
| Surface | `#151518` | Cards, panels |
| Elevated | `#1C1C20` | Hover states, drilldown |
| Border | `#232328` | Card borders, dividers |
| Primary text | `#F0EDE8` | Headings, values |
| Secondary text | `#C5C0B8` | Body text |
| Muted text | `#8A857D` | Labels, descriptions |
| Subtle text | `#5A5650` | Timestamps, meta |
| Teal (primary) | `#2DD4BF` | Completed, low risk, primary actions |
| Crimson | `#9B1B30` | Run buttons, very high risk tier |
| Gold | `#C9A227` | Running state, intermediate risk |
| Amber | `#F59E0B` | High risk tier, warnings |
| Blue | `#60A5FA` | Info, available scores |
| Purple | `#A78BFA` | Aggregate stats |
| Red | `#E85A6B` | Failed, danger actions |
| Monospace | IBM Plex Mono | Score IDs, patient IDs, timing values |

### Tier Colors

| Tier | Background | Text |
|------|------------|------|
| Low | `#2DD4BF15` | `#2DD4BF` |
| Intermediate | `#C9A22715` | `#C9A227` |
| High | `#F59E0B15` | `#F59E0B` |
| Very High | `#9B1B3015` | `#E85A6B` |
| Uncomputable | `#32323815` | `#5A5650` |

## Out of Scope

- Cohort builder integration (risk score as inclusion criterion) — Phase 3
- Custom score creation/configuration UI
- Cross-source comparison (handled by Network Analysis NA007)
- Real-time scoring at point of care
- Score calibration/validation against outcomes
- WebSocket/Reverb broadcasting (polling sufficient)
- Export/download beyond CSV from patient table
