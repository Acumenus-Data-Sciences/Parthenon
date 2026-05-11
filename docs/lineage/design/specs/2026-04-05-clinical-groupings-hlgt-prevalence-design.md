# Clinical Groupings: HLGT Sub-Groupings, Prevalence Overlay & Domain Counts Fix

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Backend API, Frontend UI, Python AI script, ClinicalGroupingSeeder

---

## Overview

Three enhancements to the clinical groupings system that together transform it from a basic navigation tool into a data-discovery platform with MedDRA HLGT-level granularity:

1. **Fix domain root counts** — The "All Domains" view shows misleading child counts (e.g., "2 categories" for Condition when 106K concepts exist)
2. **HLGT sub-groupings** — Add ~300-400 curated sub-groupings under the 27 Condition-domain parent groupings, generated via II-Medical-8B with human review
3. **Data prevalence overlay** — Show person count and record count on grouping cards, aggregated across all CDM sources with per-source filtering

---

## 1. Domain Root Counts Fix

### Problem

The `tree()` endpoint in `VocabularyController` (line 496) returns `child_count` as a subquery counting direct children in `concept_tree`. At the root level (`parent_concept_id = 0`), this produces misleading numbers:

| Domain | Direct children | Actual concepts |
|--------|----------------|-----------------|
| Condition | 2 | 106,444 |
| Procedure | 1 | 48,430 |
| Drug | 14 | 11,134 |
| Measurement | 5 | 26,859 |
| Observation | 57 | 110,724 |
| Visit | 19 | 263 |

### Solution

**Backend:** When `parent_concept_id = 0`, add a second computed column `descendant_count` — a `COUNT(*)` from `concept_tree` matching the domain. This is only computed for root-level queries (6 rows), so performance impact is negligible.

```php
// Only for root-level queries
->selectRaw('(SELECT COUNT(DISTINCT child_concept_id) FROM vocab.concept_tree ct3 WHERE ct3.domain_id = ct.domain_id AND ct3.parent_concept_id != 0) AS descendant_count')
```

**Frontend:** The `ConceptTreeNode` type gains an optional `descendant_count?: number` field. The root-level domain cards in `HierarchyBrowserPanel` display `descendant_count` when available, falling back to `child_count`. Label changes from "X categories" to "X concepts".

### Files Modified

- `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — `tree()` method
- `frontend/src/features/vocabulary/types/vocabulary.ts` — `ConceptTreeNode` type
- `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` — root card rendering

---

## 2. HLGT Sub-Groupings via AI-Assisted Curation

### Architecture

```
[II-Medical-8B via Ollama]
        |
        v
[scripts/generate_hlgt_subgroupings.py]
        |
        v
[backend/database/fixtures/groupings/*.json]  <-- human review checkpoint
        |
        v
[ClinicalGroupingSeeder second pass]
        |
        v
[app.clinical_groupings with parent_grouping_id]
```

### AI Curation Script

**File:** `scripts/generate_hlgt_subgroupings.py`

For each of the 27 Condition-domain parent groupings:

1. Query SNOMED hierarchy to retrieve immediate children of anchor concepts (natural HLGT-level breakdown)
2. Send children to II-Medical-8B via Ollama with structured prompt:
   - "Given these SNOMED concepts under {parent}, group them into clinically meaningful sub-categories analogous to MedDRA High Level Group Terms. Return JSON with name, description, and constituent concept_ids."
3. Verify all returned `concept_id` values exist in `vocab.concept`
4. Output one JSON fixture file per parent grouping

**Output format** (`backend/database/fixtures/groupings/cardiovascular_hlgt.json`):

```json
{
  "parent_grouping": "Cardiovascular",
  "domain_id": "Condition",
  "sub_groupings": [
    {
      "name": "Coronary artery disorders",
      "description": "Ischemic heart disease, coronary atherosclerosis, and acute coronary syndromes",
      "anchor_concept_ids": [312327, 4185932, 321588],
      "icon": "heart",
      "color": "#EF4444"
    }
  ]
}
```

**Estimated output:** ~10-15 sub-groupings per parent, ~300-400 total for Condition domain. Other domains (Procedure, Measurement, Observation) can follow the same pattern later.

### Seeder Extension

The `ClinicalGroupingSeeder` gains a second pass:

1. First pass: seed parent groupings (unchanged)
2. Second pass: read `backend/database/fixtures/groupings/*.json` files
3. For each sub-grouping, resolve `parent_grouping_id` by looking up the parent grouping's ID from the first pass
4. Upsert with key `(name, domain_id, parent_grouping_id)` for idempotency

### Backend API Changes

The `/v1/vocabulary/groupings` endpoint adds an optional `?include_children=true` parameter:

- When absent or `false`: current behavior — returns top-level groupings only (`whereNull('parent_grouping_id')`)
- When `true`: eager-loads child groupings via the existing `children()` Eloquent relationship and nests them as `children: ClinicalGrouping[]` on each parent

### Frontend Changes

**Navigation flow with sub-groupings:**

```
All Domains > Condition > [Groupings Grid]
                              |
                              v (click "Cardiovascular")
All Domains > Condition > Cardiovascular > [HLGT Sub-Groupings Grid]
                                               |
                                               v (click "Coronary artery disorders")
All Domains > Condition > Cardiovascular > Coronary artery disorders > [Anchors or Concepts]
```

- When a grouping card has `children.length > 0`, clicking it shows HLGT sub-grouping cards (reusing `GroupingsGrid` with slightly smaller styling) instead of going directly to anchors
- Grouping cards without children behave as today (show anchors or drill into single anchor)
- Breadcrumb gains one additional level for the sub-grouping name

### Files Modified

- `scripts/generate_hlgt_subgroupings.py` — new AI curation script
- `backend/database/fixtures/groupings/*.json` — new fixture files (27 files for Condition domain)
- `backend/database/seeders/ClinicalGroupingSeeder.php` — second pass for HLGT fixtures
- `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — `groupings()` method, `include_children` param
- `frontend/src/features/vocabulary/types/vocabulary.ts` — `ClinicalGrouping.children` field
- `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` — sub-grouping navigation
- `frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts` — pass `include_children` param

---

## 3. Data Prevalence Overlay

### Backend Endpoint

**New:** `GET /v1/vocabulary/groupings/prevalence`

**Parameters:**
- `domain_id` (required) — filter to a specific domain
- `source_id` (optional) — filter to a specific CDM source. Omit for aggregate across all sources.

**Logic:**

1. Discover available results schemas dynamically from `app.sources` + `app.source_daimons` (no hardcoded schema names)
2. For each grouping in the domain, for each anchor concept:
   - Join `concept_ancestor` to get all descendant concept_ids
   - Query Achilles results using the appropriate analysis_ids per domain:
     - **Record counts** (occurrences per concept): Condition 401, Procedure 601, Measurement 1801, Observation 801
     - **Person counts** (distinct persons per concept): Condition 400, Procedure 600, Measurement 1800, Observation 800
   - `stratum_1` in Achilles results contains the concept_id
   - Sum `count_value` across descendants for record_count and person_count respectively
3. When `source_id` is omitted, query all discovered results schemas and sum
4. When `source_id` is provided, query only that source's results schema

**Response:**

```json
{
  "data": [
    {
      "grouping_id": 1,
      "person_count": 1205,
      "record_count": 45230
    }
  ],
  "source": "all"
}
```

**Caching:** Redis cache keyed by `grouping_prevalence:{domain_id}:{source_id|all}`, TTL 24 hours. Invalidated when Achilles job completes.

### Frontend Changes

**Source selector:** A small dropdown above the groupings grid (next to the existing groupings/concepts toggle), defaulting to "All Sources". Options populated from the existing sources API. Selection persists in component state, resets on domain change.

**Grouping card badges:** Each card in `GroupingsGrid` gains a compact footer showing:
- Person count (e.g., "1.2K persons")
- Record count (e.g., "45K records")
- Uses existing muted `text-[#5A5650]` style
- Numbers formatted with K/M suffixes for readability

**Async loading:** Prevalence data is fetched separately from groupings via a new `useGroupingPrevalence(domainId, sourceId)` TanStack Query hook. Cards render immediately; counts appear with a shimmer placeholder while loading.

### Files Modified

- `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — new `groupingPrevalence()` method
- `backend/routes/api.php` — new route
- `frontend/src/features/vocabulary/types/vocabulary.ts` — prevalence types
- `frontend/src/features/vocabulary/api/vocabularyApi.ts` — new API function
- `frontend/src/features/vocabulary/hooks/useGroupingPrevalence.ts` — new hook
- `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` — source selector + card badges

---

## Implementation Order

1. **Domain root counts fix** — quick win, standalone, fixes visible bug
2. **Data prevalence overlay** — backend + frontend, no dependency on HLGT work
3. **HLGT sub-groupings** — AI script first (longest lead time for human review), then seeder + backend + frontend

Items 1 and 2 can be done in parallel. Item 3's AI script can run concurrently with 1+2, but the seeder/API/frontend changes should come after 1+2 are merged to avoid conflicts in the same files.

---

## Out of Scope

- HLGT sub-groupings for non-Condition domains (Procedure, Measurement, Observation) — follow-on work using same pattern
- Per-source prevalence breakdown in a detail view (just filter, not side-by-side comparison)
- Prevalence trending over time
- Sub-grouping editing UI in Parthenon (curation stays in JSON fixtures + seeder)
