---
doc_type: lineage
status: historical
date: 2026-05-09
owner: acumenus
module: care-bundles
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# CMS Measures: Server-Side Sort + Topic Filter Chips

**Date:** 2026-05-09
**Scope:** `/workbench/care-bundles/measures` — interactive sort/filter on the 72-measure VSAC catalog
**Commit:** `76e87577a`
**Builds on:** `b5f32d381` (title backfill) — chips and search depend on titles being populated

## Problem

After the title backfill, the page rendered all 72 measures by name but offered only free-text search and CMS-ID-ascending sort. With diverse content — diabetes care, hospital harm events, oncology screening, hybrid mortality measures — a researcher hunting for, say, "all the cardiovascular CBE-assigned measures with non-trivial value sets" had to skim the whole table.

## Approach

All sort + filter logic lives server-side so pagination and TanStack Query caching keep working. The frontend just sends params; backend builds the query.

### Filter axes
| Axis | Implementation | Notes |
|---|---|---|
| **Search** (`q`) | Existing — `cms_id ilike` / `title ilike` / `cbe_number =` | Preserved as-is |
| **Topic** (`topic`) | Curated regex map → `WHERE title ~* ?` | 14 clinical topics, see below |
| **Program candidate** (`program=yes\|no`) | `program_candidate = 'Yes'` or NOT | "Yes" rows are CMS-program-eligible measures |
| **CBE number** (`cbe=assigned\|unassigned`) | Treats `'Not Applicable'` and empty as unassigned | Matches CMS sheet conventions |
| **Min value sets** (`min_value_sets=int`) | Subquery `WHERE (SELECT COUNT(*)) >= ?` | Reuses the same subquery as the SELECT alias |

### Sort axes
Whitelisted columns: `cms_id`, `title`, `cbe_number`, `program_candidate`, `value_set_count`. Direction `asc|desc`. `value_set_count` orders by the subquery directly (Eloquent `orderByRaw`) and breaks ties on `cms_id` for stable pagination.

### Curated topic chips
Defined as a constant in `VsacController::MEASURE_TOPICS` — single source of truth, surfaced via a new `GET /v1/vsac/measures/topics` endpoint that returns live row counts so chips matching zero measures are hidden:

```php
private const MEASURE_TOPICS = [
    'diabetes' => 'diabet|glycemic|hba1c',
    'cardiovascular' => 'coronary|\\bcad\\b|antithrombotic|stemi|atrial fibrillation|hypertension|blood pressure',
    'heart_failure' => 'heart failure|hf:|\\bhf\\b|left ventricular',
    'hospital_harm' => 'hospital harm|harm[ -]',
    'cancer_screening' => 'cancer screening|colorectal cancer screening|breast cancer|cervical cancer',
    'preventive_care' => 'preventive care|screening for|tobacco|bmi|body mass index',
    'mental_health' => 'depression|adhd|dementia|substance use|suicide|opioid',
    'obstetric' => 'obstetric|cesarean|maternal|birth',
    'pediatric' => 'children|adolescent|child ',
    'imaging_quality' => 'radiation|imaging|optic nerve|retinopathy',
    'hybrid_hospital' => 'hybrid hospital',
    'oncology' => 'oncology|prostate|bladder|bone density',
    'medication_safety' => 'medication|polypharmacy|high-risk medication',
    'kidney' => 'kidney',
];
```

Live counts (verified post-deploy):

| Topic | n | Topic | n |
|---|---:|---|---:|
| Diabetes | 4 | Mental health | 8 |
| Cardiovascular | 7 | Hospital harm | 7 |
| Heart failure | 4 | Cancer screening | 3 |
| Preventive care | 7 | Obstetric | 2 |
| Pediatric | 4 | Imaging quality | 6 |
| Hybrid hospital | 2 | Oncology | 4 |
| Medication safety | 4 | Kidney | 2 |

## Implementation

### Backend
- `backend/app/Http/Controllers/Api/V1/VsacController.php`
  - Added `MEASURE_TOPICS` constant
  - Extended `measures()` validation with `sort`, `direction`, `program`, `cbe`, `min_value_sets`, `topic` (all `Rule::in`-constrained, no SQL injection surface)
  - Refactored value-set-count subquery into a single `$valueSetCountSql` variable used by both the SELECT alias and the WHERE/ORDER BY
  - New `measureTopics()` action returning `[{key, label, count}]`
- `backend/routes/api.php` — added `GET /v1/vsac/measures/topics`

### Frontend
- `frontend/src/features/carebundles-workbench/api.ts`
  - Exported `VsacMeasureSortColumn`, `VsacMeasureListParams`, `VsacMeasureTopic` types
  - `fetchVsacMeasures(params)` typed with the full param interface
  - New `fetchVsacMeasureTopics()`
- `frontend/src/features/carebundles-workbench/hooks.ts`
  - `useVsacMeasures` accepts `VsacMeasureListParams`
  - New `useVsacMeasureTopics()` (5-min staleTime, since topic counts change rarely)
- `frontend/src/features/carebundles-workbench/pages/CareBundleVsacMeasuresPage.tsx`
  - Sortable column headers (`ArrowUp` / `ArrowDown` / `ArrowUpDown` icons from lucide-react)
  - Click-to-toggle sort direction; switching column resets to sensible default (`desc` for value_set_count, `asc` otherwise)
  - Topic chip row with "All" + per-topic chips showing live counts
  - Filter row: Program Candidate select, CBE Number select, Min Value Sets numeric input
  - "Clear (N)" button shows total active filters and resets all state
  - All state changes reset `page` to 1

## Verification

End-to-end via `php artisan tinker` (controllers exercised directly):

```
── Top 3 by value-set count ──
  CMS1028v4 (69 VSs) Severe Obstetric Complications
  CMS133v14 (62 VSs) Cataracts: 20/40 or Better Visual Acuity within 90
  CMS117v14 (52 VSs) Childhood Immunization Status

── Cardiovascular + CBE assigned + Program=No (2) ──
  CMS145v14 [0070e] Coronary Artery Disease (CAD): Beta-Blocker Therapy – Prior MI
  CMS996v6  [3613e] Appropriate Treatment for ST-Segment Elevation Myocardial In

── min_value_sets=50 (4 measures) ──
  CMS1028v4 (69), CMS117v14 (52), CMS133v14 (62), CMS156v14 (51)
```

Build verification:
- `npx tsc --noEmit` → clean
- `npx vite build` → built in 1.47s, no errors
- `./deploy.sh --frontend` → all post-deploy smoke checks green
- API endpoint smoke (`curl`) → all return 401 + `application/json` (auth-required, no PHP fatals)

## Lessons

1. **Curated taxonomy + live counts beat free-text search alone.** Researchers don't always know the exact phrasing; "Hospital Harm" as a chip surfaces the 7 measures faster than typing "harm" and skimming results.
2. **Whitelisted regex topics are safer than client-supplied filters.** Backend constant + `Rule::in` means the surface for SQL injection or runaway regex is zero.
3. **Server-side sort with subquery aliases works fine** as long as the same subquery SQL is used for both SELECT and WHERE/ORDER (DRY via `$valueSetCountSql` var). Tie-breaking on `cms_id` keeps pagination stable when sort values collide.
4. **Topic chip counts double as a data-quality signal** — if a topic shows 0 it's hidden, so misnamed/missing titles surface immediately. (Today all 14 are non-zero, confirming the title backfill is healthy.)

## Files Changed

- `backend/app/Http/Controllers/Api/V1/VsacController.php` (+135, refactored measures())
- `backend/routes/api.php` (+1 route)
- `frontend/src/features/carebundles-workbench/api.ts` (+30 types/exports)
- `frontend/src/features/carebundles-workbench/hooks.ts` (+useVsacMeasureTopics)
- `frontend/src/features/carebundles-workbench/pages/CareBundleVsacMeasuresPage.tsx` (full rewrite — 290 lines)

## Related

- `cms-measure-titles-backfill-2026-05-09.md` — prerequisite that populated `app.vsac_measures.title`
- `composer-vendor-worktree-poisoning-2026-05-09.md` — the prod outage that surfaced the original symptom
