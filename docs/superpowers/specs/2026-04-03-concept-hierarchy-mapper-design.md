# Concept Hierarchy Mapper — Design Spec

**Date:** 2026-04-03
**Status:** Draft
**Scope:** Unified concept hierarchy system replacing R-Achilles dependency

## Problem Statement

Parthenon has three hierarchy-related features that are broken or missing:

1. **Vocabulary Hierarchy Tab** — `ConceptDetailPanel` calls `GET /v1/vocabulary/concepts/{id}/hierarchy`, but the backend (`VocabularyController::hierarchy()` at `backend/app/Http/Controllers/Api/V1/VocabularyController.php:247`) returns a flat list of ancestors. The frontend (`HierarchyTree.tsx`) expects a nested `ConceptHierarchyNode` with `children[]` and `is_current`. Result: always shows "No hierarchy data available."

2. **Data Explorer Treemaps** — `AchillesResultReaderService::getConceptHierarchy()` reads from `{results_schema}.concept_hierarchy`, which must be populated by an external R-Achilles run. Many results schemas (`eunomia_results`, `synpuf_results`) lack this data entirely.

3. **Cross-domain browsing** — No way to navigate the full OMOP vocabulary hierarchy top-down across all domains. Researchers must know concept IDs or names to find things.

All three draw from the same source: `vocab.concept_ancestor` (78M rows, already loaded and indexed).

## Solution Overview

Build a materialized **`vocab.concept_tree`** adjacency list (~500K classification-level edges) from `concept_ancestor`, then use it to power all three features:

- **Feature A:** Fix Vocabulary Hierarchy tab (live query from `concept_ancestor` for full-depth "you are here" tree)
- **Feature B:** New "Browse" tab on Vocabulary page (reads `concept_tree` for lazy-loaded cross-domain navigation)
- **Feature C:** Artisan command populates `{results_schema}.concept_hierarchy` from `concept_tree` (replaces R-Achilles)

### Data Flow

```
vocab.concept_ancestor (78M rows, OMOP source of truth)
        |
        +--[HierarchyBuilderService]-->  vocab.concept_tree (~500K rows, classification only)
        |                                       |
        |                                       +-->  {results}.concept_hierarchy (per-source, for treemaps)
        |                                       |         |
        |                                       |         +-->  Data Explorer HierarchyTreemap (existing, unchanged)
        |                                       |
        |                                       +-->  Browse Tab HierarchyBrowserPanel (new)
        |
        +--[live query]-->  Vocabulary Hierarchy Tab (concept detail, full depth)
```

## Data Model

### New Table: `vocab.concept_tree`

```sql
CREATE TABLE vocab.concept_tree (
    parent_concept_id  INTEGER NOT NULL,
    child_concept_id   INTEGER NOT NULL,
    domain_id          VARCHAR(20) NOT NULL,
    child_depth        SMALLINT NOT NULL,
    vocabulary_id      VARCHAR(20) NOT NULL,
    concept_class_id   VARCHAR(20) NOT NULL,
    child_name         VARCHAR(255) NOT NULL,
    PRIMARY KEY (parent_concept_id, child_concept_id)
);

CREATE INDEX idx_concept_tree_child ON vocab.concept_tree (child_concept_id);
CREATE INDEX idx_concept_tree_domain_parent ON vocab.concept_tree (domain_id, parent_concept_id);
```

- **Only standard concepts** (`standard_concept = 'S'`), except ATC which uses `'C'` (Classification)
- **`child_name`** denormalized from `vocab.concept.concept_name` to avoid joins on browse queries
- **`parent_concept_id = 0`** reserved for synthetic domain roots

### Synthetic Domain Roots

Entries with `parent_concept_id = 0`. The builder discovers domain roots dynamically at build time by finding standard concepts in each domain that have no same-domain SNOMED parent in `concept_ancestor`. Verified roots:

| child_concept_id | domain_id | child_name | Verified |
|---|---|---|---|
| 441840 | Condition | Clinical finding | Yes — 105,648 descendants, 25 direct children |
| 14 ATC 1st concepts (e.g., 21600001) | Drug | ATC 1st names | Yes — 7,223 ATC concepts across 5 levels |
| (discovered at build time) | Procedure | SNOMED root(s) | Runtime discovery |
| (discovered at build time) | Measurement | SNOMED root(s) | Runtime discovery |
| (discovered at build time) | Observation | SNOMED root(s) | Runtime discovery |
| (discovered at build time) | Visit | SNOMED root(s) | Runtime discovery |

Some domains may have multiple roots (orphan SNOMED concepts with no parent in their domain). The builder handles this by inserting one synthetic root row per orphan.

### Classification Hierarchy Rules per Domain

| Domain | Source Vocabulary | Strategy | Scope |
|--------|-----------------|----------|-------|
| Condition | SNOMED CT | Full SNOMED hierarchy, standard concepts only | ~220K edges |
| Drug | ATC + RxNorm | ATC 5 levels (1st->2nd->3rd->4th->5th), then ATC 5th -> RxNorm Ingredient. Stop at Ingredient. | ~9K edges |
| Procedure | SNOMED CT | Full SNOMED hierarchy, standard concepts only | ~125K edges |
| Measurement | SNOMED CT | SNOMED hierarchy, standard concepts only | ~100K edges |
| Observation | SNOMED CT | SNOMED hierarchy, standard concepts only | ~50K edges |
| Visit | SNOMED CT | Full hierarchy (only 263 concepts, max depth 3) | ~260 edges |

**Two-tier design:** `concept_tree` stores only classification-level edges for treemaps and browsing. The Vocabulary Hierarchy tab queries `concept_ancestor` live for full-depth single-concept context (ancestors + siblings + children).

### Existing Table: `{results_schema}.concept_hierarchy`

No schema changes. Populated from `concept_tree` by the Artisan command. Existing columns used:

```
concept_id, concept_name, treemap, concept_hierarchy_type,
level1_concept_id, level1_concept_name,
level2_concept_id, level2_concept_name,
level3_concept_id, level3_concept_name
```

Model: `App\Models\Results\ConceptHierarchy` at `backend/app/Models/Results/ConceptHierarchy.php`.

Level mapping from concept_tree depth:
- **level1** = depth 1 children of domain root (SOC equivalents)
- **level2** = depth 2
- **level3** = depth 3
- Concepts deeper than 3 roll up to their depth-3 ancestor

`treemap` column values match `AchillesResultReaderService::DOMAIN_TREEMAP_MAP`: `'Condition'`, `'Drug'`, `'Procedure'`, `'Measurement'`, `'Observation'`, `'Visit'`.

## Backend Components

### 1. Migration

New migration creating `vocab.concept_tree` table with indexes.

### 2. `HierarchyBuilderService`

Service class in `App\Services\Vocabulary\HierarchyBuilderService`.

**Methods:**
- `buildAll(): void` — builds concept_tree for all 6 domains
- `buildDomain(string $domain): void` — builds for a single domain
- `populateResultsSchemas(): void` — populates concept_hierarchy in all results daimons
- `populateResultsSchema(string $schema): void` — populates a single results schema

**Build algorithm per domain:**
1. Delete existing rows for the domain from concept_tree
2. INSERT...SELECT from concept_ancestor + concept:
   - `min_levels_of_separation = 1` (direct parent-child only)
   - Both parent and child are standard_concept = 'S' and in the target domain
   - For Drug: walk ATC hierarchy separately (vocabulary_id = 'ATC'), then ATC 5th -> RxNorm Ingredient
3. Compute `child_depth` using a recursive CTE from domain root
4. Insert synthetic root row (parent_concept_id = 0)

### 3. Artisan Command: `vocabulary:build-hierarchy`

```
php artisan vocabulary:build-hierarchy
    {--domain= : Build for specific domain only}
    {--fresh : Drop and rebuild from scratch}
    {--populate-results : Also populate concept_hierarchy in all results schemas}
```

### 4. Auto-trigger

At the end of `LoadVocabularies::handle()` (`backend/app/Console/Commands/LoadVocabularies.php`), add:
```php
$this->call('vocabulary:build-hierarchy', ['--populate-results' => true]);
```

### 5. `VocabularyController::hierarchy()` rewrite

File: `backend/app/Http/Controllers/Api/V1/VocabularyController.php:247`

Current behavior: returns flat array of ancestors from concept_ancestor.

New behavior: builds a nested `ConceptHierarchyNode` tree:
1. Query ancestors (concept_ancestor WHERE descendant = selected, ordered by min_levels_of_separation DESC)
2. Query siblings at each ancestor level (same parent, same domain)
3. Query immediate children of the selected concept
4. Build nested tree: root -> ancestor path (with siblings) -> selected concept (is_current: true) -> children
5. Prune to keep response reasonable: cap siblings at 50 per level (sorted alphabetically), don't expand sibling subtrees

Response matches existing `ConceptHierarchyNode` type in `frontend/src/features/vocabulary/types/vocabulary.ts:22-32`.

### 6. New endpoint: `GET /v1/vocabulary/tree`

New method on `VocabularyController` (or a new `ConceptTreeController`).

Query params:
- `parent_concept_id` (optional, default 0 = domain roots)
- `domain_id` (optional, filter to single domain)

Returns array of `ConceptTreeNode` children with `child_count` for expand arrows.

Route: inside the existing `auth:sanctum` + `permission:vocabulary.view` middleware group in `backend/routes/api.php`.

## Frontend Components

### 1. `VocabularyPage.tsx` — add Browse tab

File: `frontend/src/features/vocabulary/pages/VocabularyPage.tsx`

Current `SearchTab` type: `"keyword" | "semantic"`. Add `"browse"`.

Tabs array (line 34) gets a third entry with tree icon. Active tab render (line 93) gets third branch rendering `HierarchyBrowserPanel`.

### 2. New `HierarchyBrowserPanel` component

Location: `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`

- Top level: 6 domain cards with concept counts from `GET /v1/vocabulary/tree` (parent_concept_id = 0)
- Click domain: drills into children via `GET /v1/vocabulary/tree?parent_concept_id={id}`
- Lazy loads one level at a time
- Breadcrumb navigation for drill path
- Clicking a leaf concept calls `onSelectConcept(id)` to open ConceptDetailPanel

### 3. New `useConceptTree` hook

Location: `frontend/src/features/vocabulary/hooks/useConceptTree.ts`

```typescript
export function useConceptTree(parentConceptId: number) {
  return useQuery({
    queryKey: ["vocabulary", "tree", parentConceptId],
    queryFn: () => fetchConceptTreeChildren(parentConceptId),
  });
}
```

### 4. New type: `ConceptTreeNode`

Added to `frontend/src/features/vocabulary/types/vocabulary.ts`:

```typescript
export interface ConceptTreeNode {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  child_count: number;
  depth: number;
}
```

### 5. New API function

Added to `frontend/src/features/vocabulary/api/vocabularyApi.ts`:

```typescript
export async function fetchConceptTreeChildren(
  parentConceptId: number,
  domainId?: string,
): Promise<ConceptTreeNode[]> {
  const { data } = await apiClient.get(`${BASE}/tree`, {
    params: { parent_concept_id: parentConceptId, domain_id: domainId },
  });
  return data.data ?? [];
}
```

### 6. No changes to existing components

- `HierarchyTree.tsx` — already renders ConceptHierarchyNode correctly
- `useConceptHierarchy.ts` — already wired to the hierarchy endpoint
- `ConceptDetailPanel.tsx` — already has Hierarchy tab rendering HierarchyTree
- `DomainTab.tsx`, `HierarchyTreemap.tsx`, `useAchillesData.ts` — unchanged
- `AchillesResultReaderService.php` — unchanged (reads concept_hierarchy as before)

## What This Does NOT Change

- No changes to `vocab.concept_ancestor` (read-only OMOP table)
- No changes to `vocab.concept` or any other vocabulary tables
- No changes to the Data Explorer treemap rendering or API
- No changes to Achilles analysis IDs or result reader logic
- No changes to authentication, routes middleware, or permissions (new endpoints use existing `vocabulary.view` permission)

## Estimated Scale

| Table | Rows | Size |
|-------|------|------|
| vocab.concept_tree | ~500K | ~50MB |
| concept_hierarchy (per results schema) | ~500K | ~60MB |
| Build time | <60s | Single SQL pass |
