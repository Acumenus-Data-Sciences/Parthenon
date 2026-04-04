# Cohort Similarity Parity Upgrade — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Patient Similarity page — bring "From Cohort" workflow to full parity with "Single Patient", add cohort-vs-cohort comparison and cohort expansion

---

## Problem

The Patient Similarity page has two search modes: Single Patient and From Cohort. The cohort mode is bare-bones compared to single patient — it lacks dimension weight sliders, data source selection, age/gender filters, result enrichment (shared features, narratives), and error handling for ungenerated cohorts. Additionally, there is no way to compare two cohorts or iteratively expand a cohort with similar patients.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel layout | Scrollable stack (option B) | Mirrors Single Patient form exactly for consistency |
| Centroid/exemplar strategy | Drop exemplar | Exemplar is redundant with Single Patient tab |
| Ungenerated cohort UX | Inline action button (option B) | Researchers shouldn't navigate away; generate API already exists |
| Cohort-vs-cohort location | Third tab (option A) | Keeps everything in one page, matches existing tab pattern |
| Cohort expansion | Yes — "Add to Cohort" action | Iterative cohort growth is a valuable research workflow |

---

## 1. Search Mode Architecture

Three tabs on the Patient Similarity page:

| Tab | Seed Input | Left Panel | Right Panel |
|-----|-----------|------------|-------------|
| **Single Patient** | Person ID (live search) | Source, ID, weights, filters | Results table + detail rows |
| **From Cohort** | Cohort dropdown | Source, cohort, radar, weights, filters | Results table + detail rows |
| **Compare Cohorts** | Two cohort dropdowns | Source cohort, target cohort | Overlaid radar + divergence + patient matches |

- Mode toggle (auto/interpretable/embedding) and staleness indicator remain shared across all three tabs.
- The `SearchMode` type changes from `"single" | "cohort"` to `"single" | "cohort" | "compare"`.

---

## 2. CohortSeedForm Upgrade (From Cohort Tab)

Scrollable stack layout, top to bottom:

### 2.1 Data Source Selector
Same `<select>` as Single Patient, sourced from `useSourceStore()`. Syncs with global active source. When source changes, cohort dropdown re-filters and radar chart resets.

### 2.2 Seed Cohort Dropdown
Dropdown of cohort definitions. Filtered to show all cohorts (generation status checked separately). On selection, fires the `cohort-profile` query to load radar data.

### 2.3 Generation Status Banner
Three states based on the cohort-profile API response:

- **Generated:** Green pill — `"42 members · Generated 2h ago"`. Shown inline below the dropdown.
- **Not generated:** Yellow banner — `"Cohort not generated for this source"` with a **"Generate Now"** button. Button calls `POST /cohort-definitions/{id}/generate` with `source_id`.
- **Generating:** Progress indicator with polling. Reuses the existing `useComputeStatus` pattern — poll every 3 seconds until generation completes, then auto-fetch the cohort profile.

### 2.4 Radar Chart
`CohortCentroidRadar` component — appears once cohort has members. Shows coverage (teal, solid) and diversity (gold, dashed) across 6 dimensions. Already implemented; no changes needed to the component itself.

### 2.5 Dimension Weight Sliders
Identical to Single Patient's implementation in `SimilaritySearchForm`:
- 6 sliders: Demographics, Conditions, Measurements, Drugs, Procedures, Genomics
- Range: 0–5, step 0.5
- Initialized from `SimilarityDimension` defaults via `useSimilarityDimensions()`
- Passed as `weights` in the search params

### 2.6 Filters (Optional)
Identical to Single Patient:
- Age range: min/max text inputs
- Gender: dropdown (Any / Male / Female)
- Passed as `filters` in the search params

### 2.7 Submit Button
"Find Similar Patients" — same styling as Single Patient. Disabled when no cohort selected, source <= 0, or cohort not generated.

---

## 3. Results Parity

### 3.1 Enriched Results
Cohort search results receive the same enrichment as single patient results:
- Per-dimension score bars in the `SimilarPatientTable`
- Expandable detail rows with shared features (conditions, drugs, procedures concept pills)
- Similarity narrative summaries from `SimilarityExplainer`

Backend change: `searchFromCohort` controller method must call `$this->enrichSearchResults()` on the results before returning, same as the `search` method does.

### 3.2 Results Header Bar
Cohort-specific metadata in the header:
- Show `"Seed: [Cohort Name] (N members)"` instead of seed person ID
- Show cohort member count alongside result count and candidate count
- Mode indicator and timing remain the same

### 3.3 Compare Link
Each result row's "Compare" link compares the result patient against the cohort centroid. This requires the centroid to have a virtual `person_id` (e.g., `0` or `-1`) and the compare endpoint to handle centroid-vs-patient comparison. Alternatively, the compare link can be hidden in cohort mode for the initial implementation and added later.

**Decision for v1:** Hide the per-row "Compare" link in cohort mode. The cohort centroid is not a real patient, so the existing compare page (which expects two person IDs) would need significant changes. This can be a follow-up enhancement. Implementation note: `SimilarPatientTable` already hides the Compare link when `seedPersonId` is falsy — cohort mode passes `0` or `undefined` as `seedPersonId`, so no component change is needed.

---

## 4. Export + Cohort Expansion

Two export actions available after a cohort similarity search:

### 4.1 Export as New Cohort (Existing)
`CohortExportDialog` — creates a new `cohort_definitions` record and inserts matched patients into `results.cohort`. No changes needed.

### 4.2 Add to Source Cohort (New)
New action button in the results header bar: **"Add to [Cohort Name]"**

**UI flow:**
1. Button appears only in cohort search mode, next to "Export as Cohort"
2. Opens a confirmation dialog:
   - Title: `"Expand [Cohort Name]"`
   - Body: `"Add N similar patients to this cohort? Current size: M members. New size: M + N = total."`
   - Min score slider (same as export dialog) to filter which results get added
   - Confirm / Cancel buttons
3. On confirm: calls `POST /patient-similarity/expand-cohort`
4. On success: invalidates cohort profile query, shows success toast with new member count

**Backend endpoint:** `POST /v1/patient-similarity/expand-cohort`

```
Request:
{
  "cohort_definition_id": 225,
  "source_id": 58,
  "person_ids": [12345, 67890, ...],
  "cache_id": 42  // optional — pull person_ids from cache instead
}

Response:
{
  "data": {
    "cohort_definition_id": 225,
    "added_count": 47,
    "skipped_duplicates": 3,
    "new_total": 89
  }
}
```

Implementation:
- INSERT INTO `results.cohort` (`cohort_definition_id`, `subject_id`, `cohort_start_date`, `cohort_end_date`) for each person_id
- Skip duplicates (person_ids already in the cohort)
- Use the person's earliest `visit_occurrence.visit_start_date` as `cohort_start_date` and latest `visit_end_date` as `cohort_end_date`
- Permission: requires `patient-similarity.view` (same as export)

---

## 5. Compare Cohorts Tab

### 5.1 Left Panel (CohortCompareForm)
New component: `CohortCompareForm`

Scrollable stack:
1. **Data Source selector** — shared source for both cohorts
2. **Source Cohort dropdown** + generation status banner
3. **Target Cohort dropdown** + generation status banner
4. **Compare button** — disabled until both cohorts are selected and generated

### 5.2 Right Panel — Profile Comparison

**Overlaid Radar Chart:**
New component: `CohortComparisonRadar` — extends `CohortCentroidRadar` to accept two profiles.
- Source cohort: teal solid line
- Target cohort: gold solid line
- Shared Recharts `<RadarChart>` with two `<Radar>` data series

**Divergence Scores:**
Per-dimension divergence displayed as a horizontal bar list:
- Score 0–1 (0 = identical profiles, 1 = completely different)
- Color coding: green (< 0.3), yellow (0.3–0.6), red (> 0.6)
- Labels: "Similar", "Moderate", "Divergent"
- Overall divergence score (weighted average using dimension weights)

**Computation:** Divergence for each dimension = `1 - cosine_similarity(centroid_a_slice, centroid_b_slice)` using the same embedding slice ranges as `PatientEmbeddingService`.

### 5.3 Cross-Cohort Patient Matching

**"Find Matching Patients" button** — appears below divergence scores.

Triggers `POST /patient-similarity/cross-cohort-search`:
```
Request:
{
  "source_cohort_id": 225,
  "target_cohort_id": 230,
  "source_id": 58,
  "limit": 20,
  "min_score": 0.0
}

Response: same shape as SimilaritySearchResult
{
  "seed": { "person_id": 0, "cohort_name": "Source Cohort", ... },
  "mode": "embedding",
  "similar_patients": [...],
  "metadata": { ... }
}
```

Implementation: uses source cohort's centroid as seed, searches across all patients in the source's dataset, excludes members of BOTH cohorts. Returns ranked patient list using the standard similarity pipeline.

Results render in the same `SimilarPatientTable` component. "Export as Cohort" and "Add to [Target Cohort]" actions both available.

---

## 6. Backend Changes Summary

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `POST /patient-similarity/search-from-cohort` | POST | **Modify** | Add weights/filters support; call `enrichSearchResults()` on results; return cohort name in metadata |
| `GET /patient-similarity/cohort-profile` | GET | **Modify** | Return 200 with `{ data: { generated: false } }` instead of 404 for empty cohorts |
| `POST /patient-similarity/expand-cohort` | POST | **New** | Append person_ids to existing cohort's results.cohort table, deduplicate |
| `POST /patient-similarity/compare-cohorts` | POST | **New** | Return both cohort profiles + per-dimension divergence scores |
| `POST /patient-similarity/cross-cohort-search` | POST | **New** | Find patients similar to source centroid, excluding both cohorts' members |

### Route Middleware

All new endpoints follow HIGHSEC:
```php
Route::post('/expand-cohort', ...)->middleware('permission:patient-similarity.view');
Route::post('/compare-cohorts', ...)->middleware('permission:patient-similarity.view');
Route::post('/cross-cohort-search', ...)->middleware(['permission:patient-similarity.view', 'throttle:30,1']);
```

---

## 7. Frontend Changes Summary

| File | Change |
|------|--------|
| `PatientSimilarityPage.tsx` | Add "Compare Cohorts" tab; update `SearchMode` type; add cohort name to results header |
| `CohortSeedForm.tsx` | Add source selector, weight sliders, filters, generation status banner; remove strategy toggle |
| `CohortCompareForm.tsx` | **New** — two cohort dropdowns + compare button + generation status for both |
| `CohortComparisonRadar.tsx` | **New** — overlaid dual-cohort radar chart |
| `DivergenceScores.tsx` | **New** — per-dimension divergence bar display |
| `CohortExpandDialog.tsx` | **New** — confirmation dialog for "Add to Cohort" action |
| `CohortCentroidRadar.tsx` | No changes |
| `SimilarPatientTable.tsx` | No changes (already handles all result shapes) |
| `CohortExportDialog.tsx` | No changes |
| `patientSimilarityApi.ts` | Add `compareCohorts()`, `crossCohortSearch()`, `expandCohort()` functions |
| `usePatientSimilarity.ts` | Add `useCompareCohorts`, `useCrossCohortSearch`, `useExpandCohort` hooks |
| `patientSimilarity.ts` (types) | Add `CohortComparisonResult`, `CohortDivergence`, `ExpandCohortParams`, `ExpandCohortResult` types; update `CohortSimilaritySearchParams` (remove `strategy`, add `weights`, `filters`) |

---

## 8. Out of Scope

- Centroid-vs-patient comparison page (Compare link in cohort result rows) — requires virtual patient concept; follow-up
- Exemplar strategy — dropped per design decision
- Cohort generation progress tracking (detailed step-by-step) — uses simple polling for now
- Shareable URLs for cohort searches — could add query param support later
- Batch cohort comparison (compare N cohorts at once) — single pair comparison for v1
