# Cohort Similarity Parity Upgrade — From Cohort, Compare Cohorts, and Cohort Expansion

**Date:** 2026-04-04
**Scope:** Patient Similarity page — full parity between "Single Patient" and "From Cohort" workflows, new "Compare Cohorts" tab, iterative cohort expansion, and Jobs page integration for cohort generation

---

## Problem

The Patient Similarity page shipped with two search modes — Single Patient and From Cohort — but the cohort mode was bare-bones. It lacked dimension weight sliders, data source selection, age/gender filters, result enrichment (shared features, narratives), and error handling for ungenerated cohorts. The page crashed with `Cannot read properties of undefined (reading 'length')` when selecting a cohort that hadn't been generated. Additionally, there was no way to compare two cohorts or iteratively expand a cohort with similar patients. Cohort generation jobs didn't show on the Jobs page.

## What Changed

### Three-Tab Architecture

The Patient Similarity page now has three tabs:

| Tab | Purpose |
|-----|---------|
| **Single Patient** | Find patients similar to a seed patient (unchanged) |
| **From Cohort** | Find patients similar to a cohort's centroid profile |
| **Compare Cohorts** | Compare two cohort profiles and find cross-cohort matches |

### From Cohort — Full Parity

The `CohortSeedForm` was rewritten from ~130 lines (cohort dropdown + strategy toggle) to ~220 lines that mirror the Single Patient form exactly:

- **Data Source selector** — same dropdown, syncs with global active source
- **Cohort dropdown** with inline generation status:
  - Green pill: "N members" when generated
  - Yellow banner: "Not generated" + **Generate Now** button when ungenerated
  - Spinner + 5-second polling: auto-refreshes when generation completes
- **Radar chart** — appears once cohort has members
- **6 dimension weight sliders** — identical to Single Patient (0–5 range, 0.5 step)
- **Age/gender filters** — identical to Single Patient
- **Enriched results** — shared features, concept pills, similarity narratives (same as single patient)
- **Cohort-specific results header** — shows "Seed: [Cohort Name] (N members)"

The centroid/exemplar strategy toggle was dropped — exemplar was just single-patient search with extra steps.

### Compare Cohorts Tab

New tab with:
- Two cohort dropdowns (source + target) with generation status banners
- **Compare Profiles** button → overlaid radar chart (teal = source, gold = target)
- **Divergence scores** — per-dimension divergence bars (green < 0.3, yellow 0.3–0.6, red > 0.6)
- **Find Matching Patients** button → cross-cohort search excluding both cohorts' members

### Cohort Expansion

After a cohort similarity search, a new **"Add to [Cohort Name]"** button appears in the results header (gold, `UserPlus` icon). Clicking it opens a confirmation dialog with:
- Min score slider to filter which results get added
- Preview: "Current size: M → New size: M + N"
- Deduplication (skips patients already in the cohort)
- Auto-refreshes radar chart after expansion

### Jobs Page Integration

Cohort generation jobs now appear on the Jobs page with:
- Name: "Cohort Generation — [Cohort Name]"
- Source name, status, progress %, person count on completion
- Live timer via the Jobs page's adaptive polling (1s when active, 10s when idle)

## New Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /patient-similarity/expand-cohort` | New | Append similar patients to existing cohort, with dedup |
| `POST /patient-similarity/compare-cohorts` | New | Return both profiles + per-dimension divergence |
| `POST /patient-similarity/cross-cohort-search` | New | Find patients similar to source centroid, excluding both cohorts |

### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /patient-similarity/cohort-profile` | Returns 200 with `generated: false` instead of 404 for empty cohorts; added `generated` boolean field |
| `POST /patient-similarity/search-from-cohort` | Added enrichment (shared features, narratives), tiered access, cohort name in metadata; removed strategy param |

### Refactored

- `enrichSearchResults()` — now handles centroid seeds (person_id = 0) by using the centroid array directly instead of looking up a nonexistent DB vector
- `buildDimensionProfile()` — extracted from inline code in `cohortProfile()`, reused by `compareCohorts()`

## New Frontend Components

| Component | Purpose |
|-----------|---------|
| `GenerationStatusBanner` | Reusable — shows generation status with "Generate Now" button + polling |
| `CohortExpandDialog` | Confirmation dialog for "Add to Cohort" with min score slider |
| `CohortCompareForm` | Two cohort dropdowns + compare/cross-search buttons |
| `CohortComparisonRadar` | Overlaid dual-cohort radar chart (Recharts) |
| `DivergenceScores` | Per-dimension divergence bars with color coding |

## Bugs Fixed During Implementation

1. **`$memberCount` undefined** — refactoring `cohortProfile()` to use `buildDimensionProfile()` removed the `$memberCount` variable but left a reference in the response. Fixed with `$vectors->count()`.
2. **Polling interval leak** — `GenerationStatusBanner`'s `useEffect` had `profile` (full object) in the dependency array, causing new intervals to spawn on every refetch. Fixed by depending on the primitive `profile?.generated` boolean instead.
3. **Test data leakage** — expand-cohort test inserted a row into `pancreas_results.cohort` but cleanup ran against the default `results` schema. Fixed by using the SourceContext-aware connection for cleanup.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Patient Similarity Page                    │
│  ┌──────────┬──────────────┬─────────────────┐              │
│  │  Single  │  From Cohort │ Compare Cohorts │  ← 3 tabs    │
│  └──────────┴──────────────┴─────────────────┘              │
│                                                              │
│  Left Panel (320px)          Right Panel                     │
│  ┌────────────────┐         ┌──────────────────────────────┐│
│  │ Source selector │         │ Results header (seed info)   ││
│  │ Cohort dropdown │         │ [Export] [Add to Cohort]     ││
│  │ Gen status      │         ├──────────────────────────────┤│
│  │ Radar chart     │         │ Compare: Overlaid radar      ││
│  │ Weight sliders  │         │          Divergence scores   ││
│  │ Filters         │         ├──────────────────────────────┤│
│  │ [Search]        │         │ SimilarPatientTable          ││
│  └────────────────┘         │ (shared features, narratives)││
│                              └──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```
