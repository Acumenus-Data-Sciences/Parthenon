# Population Risk Scores — Frontend Design

**Date:** 2026-03-28
**Status:** Approved

## Goal

Build a frontend for the existing Population Risk Score engine (20 calculators, 4 API endpoints, results table — all backend-complete, never wired to UI). Catalogue-first design with source-aware score cards, Achilles-pattern run modal with eligibility pre-flight, and drill-through detail pages.

## Backend State (Already Built)

### 20 Score Calculators

| ID | Name | Category |
|----|------|----------|
| RS001 | Framingham Risk Score | Cardiovascular |
| RS002 | Pooled Cohort Equations | Cardiovascular |
| RS003 | CHA2DS2-VASc | Cardiovascular |
| RS004 | HAS-BLED | Cardiovascular |
| RS005 | Charlson Comorbidity Index | Comorbidity |
| RS006 | Elixhauser Index | Comorbidity |
| RS007 | MELD Score | Hepatic |
| RS008 | Child-Pugh Score | Hepatic |
| RS009 | Revised Cardiac Risk Index | Cardiovascular |
| RS010 | CURB-65 | Pulmonary |
| RS011 | Diabetes Complications Severity | Comorbidity |
| RS012 | SCORE2 | Cardiovascular |
| RS013 | FIB-4 Index | Hepatic |
| RS014 | Metabolic Syndrome | Metabolic |
| RS015 | TIMI Risk Score | Cardiovascular |
| RS016 | FRAX Fracture Risk | Musculoskeletal |
| RS017 | GRACE Score | Cardiovascular |
| RS018 | STOP-BANG Apnea | Pulmonary |
| RS019 | CHADS2 Score | Cardiovascular |
| RS020 | Multimorbidity Burden | Comorbidity |

### Existing API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/risk-scores/catalogue` | List all 20 score models with metadata |
| GET | `/sources/{source}/risk-scores` | List past run results for a source |
| POST | `/sources/{source}/risk-scores/run` | Execute score computation |
| GET | `/sources/{source}/risk-scores/{scoreId}` | Detail results for one score |

### Results Table (`app.population_risk_score_results`)

Columns: id, source_id, score_id, score_name, category, risk_tier, patient_count, total_eligible, mean_score, p25_score, median_score, p75_score, mean_confidence, mean_completeness, missing_components, run_at, created_at, updated_at

### Backend Files

- `PopulationRiskScoreController.php` — 4 endpoints
- `PopulationRiskScoreEngineService.php` — orchestration
- `PopulationRiskScoreRegistry.php` — score discovery
- `PopulationRiskScoreInterface.php` — contract
- `PopulationRiskServiceProvider.php` — DI registration
- `PopulationRiskScoreResult.php` — Eloquent model
- `Services/PopulationRisk/Scores/RS001-RS020` — 20 calculator implementations

## Navigation

**Location:** Evidence group, after Patient Profiles

```
Evidence
  ├─ Patient Profiles    /profiles
  ├─ Risk Scores         /risk-scores        ← NEW
  ├─ Genomics            /genomics
  ├─ Imaging             /imaging
  ├─ HEOR                /heor
  └─ GIS Explorer        /gis
```

**Routes:**
- `/risk-scores` — Catalogue page (score cards grid)
- `/risk-scores/:scoreId` — Detail page (distributions, tiers, patient list)

## Page 1: Catalogue (`/risk-scores`)

### Layout

Grid of score cards, 3 columns desktop / 2 tablet / 1 mobile. Cards grouped by category with section headers.

### Category Groups

- **Cardiovascular:** Framingham, PCE, CHA2DS2-VASc, HAS-BLED, SCORE2, TIMI, GRACE, CHADS2, RCRI
- **Hepatic:** MELD, Child-Pugh, FIB-4
- **Comorbidity:** Charlson, Elixhauser, Multimorbidity Burden, Diabetes Complications
- **Pulmonary:** CURB-65, STOP-BANG
- **Metabolic:** Metabolic Syndrome
- **Musculoskeletal:** FRAX

### Card States

**No source selected:**
- Score name + category badge + description
- Disabled "Run" button with "Select a source" tooltip

**Source selected, no results:**
- Score name + category badge + description
- "Run" button (crimson accent) if eligible
- "Insufficient Data" badge (gray) if ineligible, with tooltip listing missing components

**Source selected, results exist:**
- Score name + category badge + description
- Summary: eligible patient count, mean score
- Mini horizontal stacked bar showing tier distribution (low=teal, medium=gold, high=orange, very high=crimson)
- Last run timestamp
- "View Details" button + "Re-run" icon button

### Pre-Flight Eligibility

New backend endpoint: `GET /sources/{source}/risk-scores/eligibility`

Returns per-score eligibility based on CDM data availability:

```json
{
  "RS005": { "eligible": true, "patient_count": 361, "missing": [] },
  "RS001": { "eligible": false, "patient_count": 0, "missing": ["measurement (lipid panel)"] }
}
```

Called once on page load (or source change). Determines which cards show "Run" vs "Insufficient Data".

### Actions

- **Run individual:** Click "Run" on a card → opens run modal for that single score
- **Run All Eligible:** Header button → opens run modal for all eligible scores
- **Re-run:** Icon button on cards with existing results → opens run modal

## Run Modal (Achilles Pattern)

Replicates `AchillesRunModal.tsx` exactly:

### Structure

- **Header:** "Population Risk Scores" + animated activity icon (running) or checkmark (done)
- **Subtitle:** Live elapsed timer while running, completion summary when done
- **Progress:** Large percentage + progress bar (gold-to-teal gradient, gold-to-red if failures)
- **Stats badges:** `X passed`, `X failed`, `X ineligible (skipped)`, duration, ETA

### Score Rows (grouped by category, collapsible)

```
[status-icon] [RS005] [Charlson Comorbidity Index]     [3.2s]
[status-icon] [RS006] [Elixhauser Index]                [running... 1.4s]
[status-icon] [RS001] [Framingham Risk Score]            [ineligible]
```

Status icons:
- Pending: gray clock
- Running: gold animated spinner + live timer
- Completed: green checkmark + elapsed seconds
- Failed: red alert icon, expandable error detail (monospace)
- Ineligible: gray skip icon + reason

Auto-collapse completed categories. Category headers show completion count (e.g., "Comorbidity 2/3").

### Real-Time Updates

Polling at 2-second intervals via `GET /sources/{source}/risk-scores/runs/{run_id}`.

Response:
```json
{
  "run_id": "uuid",
  "status": "running",
  "total": 8,
  "completed": 3,
  "failed": 1,
  "skipped": 4,
  "scores": [
    { "score_id": "RS005", "status": "completed", "elapsed_ms": 1200 },
    { "score_id": "RS006", "status": "running" },
    { "score_id": "RS001", "status": "skipped", "reason": "No lipid panel measurements" },
    { "score_id": "RS003", "status": "queued" }
  ]
}
```

Stop polling when status is `completed` or `failed`.

### Queued Execution

Backend runs scores sequentially within a Horizon job. Controller returns `run_id` immediately. Individual failures don't block remaining scores.

## Page 2: Detail Page (`/risk-scores/:scoreId`)

### Header

Score name, category badge, one-paragraph description of what the score measures and its clinical significance. Last run timestamp. "Re-run" button.

### Distribution Panel

- Histogram of score values across the population (auto-binned)
- Vertical reference lines at p25, median, p75
- Summary stats row: mean, median, p25, p75, eligible count, completeness %

### Tier Breakdown Panel

- Horizontal stacked bar: low (teal), medium (gold), high (orange), very high (crimson)
- Table below:

| Tier | Count | % | Mean Score |
|------|-------|---|------------|
| Low | 180 | 50% | 1.2 |
| Medium | 100 | 28% | 3.4 |
| High | 60 | 17% | 5.8 |
| Very High | 21 | 6% | 8.1 |

Each row clickable → filters patient list below.

### Patient List Panel

Sortable, filterable TanStack Table:

| Patient ID | Score | Tier | Confidence | Missing Components |
|------------|-------|------|------------|-------------------|
| 42 | 5 | High | 0.95 | — |
| 17 | 3 | Medium | 0.80 | lipid panel |

- Filterable by tier (clicking tier breakdown row above)
- Click patient row → navigates to `/profiles?source={sourceId}&person={personId}`

### Data Gaps Panel

Summary of missing data components across the population:
- "42 patients missing lipid panel"
- "18 patients missing creatinine measurement"
- Helps data stewards prioritize data ingestion

## New Backend Endpoints Required

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/sources/{source}/risk-scores/eligibility` | Pre-flight CDM data check per score |
| GET | `/sources/{source}/risk-scores/runs/{runId}` | Polling endpoint for run progress |

The existing 4 endpoints remain unchanged.

## Frontend File Structure

```
frontend/src/features/risk-scores/
  ├── pages/
  │   ├── RiskScoreCataloguePage.tsx      — Card grid with categories
  │   └── RiskScoreDetailPage.tsx         — Distribution + tiers + patient list
  ├── components/
  │   ├── RiskScoreCard.tsx               — Individual score card (3 states)
  │   ├── RiskScoreRunModal.tsx           — Achilles-pattern progress modal
  │   ├── TierBreakdownChart.tsx          — Stacked bar + table
  │   ├── ScoreDistributionChart.tsx      — Histogram with percentile lines
  │   └── PatientScoreTable.tsx           — TanStack sortable/filterable table
  ├── hooks/
  │   ├── useRiskScoreCatalogue.ts        — GET /risk-scores/catalogue
  │   ├── useRiskScoreEligibility.ts      — GET /sources/{source}/risk-scores/eligibility
  │   ├── useRiskScoreResults.ts          — GET /sources/{source}/risk-scores
  │   ├── useRiskScoreDetail.ts           — GET /sources/{source}/risk-scores/{scoreId}
  │   ├── useRunRiskScores.ts             — POST mutation + polling
  │   └── useRiskScoreProgress.ts         — GET /sources/{source}/risk-scores/runs/{runId}
  ├── api/
  │   └── riskScoreApi.ts                 — All fetch functions
  └── types/
      └── riskScore.ts                    — TypeScript interfaces
```

## Design System

Follows Parthenon dark clinical theme:
- Base: #0E0E11
- Crimson accent: #9B1B30 (run buttons, very high tier)
- Gold: #C9A227 (running state, progress bars, medium tier)
- Teal: #2DD4BF (completed state, low tier)
- Orange: #F59E0B (high tier)
- Monospace: IBM Plex Mono for score IDs and timing
- Charts: Recharts (already used throughout Parthenon)

## Out of Scope

- Cohort builder integration (risk score as cohort criteria) — Phase 2
- WebSocket/Reverb broadcasting for run progress (polling sufficient for 20 scores)
- Custom score creation/configuration
- Score comparison across sources (Network Analysis NA007 already handles this)
- Export/download of results
