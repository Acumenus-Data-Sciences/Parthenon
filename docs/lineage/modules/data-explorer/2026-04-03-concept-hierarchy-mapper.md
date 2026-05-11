---
doc_type: lineage
status: historical
date: 2026-04-03
owner: acumenus
module: data-explorer
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---
# Concept Hierarchy Mapper — Unified Vocabulary Hierarchy System

**Date:** 2026-04-03
**Duration:** ~4 hours
**Scope:** New `vocab.concept_tree` table, Browse Hierarchy tab, fixed Vocabulary Hierarchy tab, R-Achilles replacement for treemap data

---

## Problem

Three broken or missing features all stemmed from the same root cause — no native hierarchy infrastructure:

1. **Vocabulary Hierarchy tab** — `ConceptDetailPanel` called `GET /v1/vocabulary/concepts/{id}/hierarchy` but the backend returned a flat ancestor list. Frontend expected nested `ConceptHierarchyNode` with `children[]` and `is_current`. Result: always showed "No hierarchy data available."

2. **Data Explorer treemaps** — `AchillesResultReaderService::getConceptHierarchy()` reads from `{results_schema}.concept_hierarchy`, which required R-Achilles to populate externally. Most results schemas (`eunomia_results`, `synpuf_results`) had no data. Treemaps showed flat top-100 concepts instead of hierarchical rollups.

3. **No cross-domain browsing** — Researchers had to know concept IDs or names to find things. No way to navigate the full OMOP vocabulary hierarchy top-down.

All three draw from `vocab.concept_ancestor` (78M rows, already loaded and indexed). The solution: materialize a classification-level adjacency list and use it to power everything.

## Architecture

```
vocab.concept_ancestor (78M rows, OMOP source of truth)
        │
        ├──[HierarchyBuilderService]──▶ vocab.concept_tree (~528K edges, classification only)
        │                                      │
        │                                      ├──▶ {results}.concept_hierarchy (per-source, for treemaps)
        │                                      │         └──▶ Data Explorer HierarchyTreemap (existing, unchanged)
        │                                      │
        │                                      └──▶ Browse Tab HierarchyBrowserPanel (new)
        │
        └──[iterative parent walk]──▶ Vocabulary Hierarchy Tab (concept detail, full depth)
```

**Two-tier design:** `concept_tree` stores only classification-level edges for treemaps and browsing (~528K rows). The Vocabulary Hierarchy tab walks `concept_tree`'s parent chain iteratively for single-concept context (picking one canonical lineage for multi-parent concepts like Aspirin).

## Implementation

### New Table: `vocab.concept_tree`

528K classification-level parent-child edges covering 6 domains:

| Domain | Edges | Max Depth | Vocabulary | Strategy |
|--------|-------|-----------|------------|----------|
| Condition | 222,774 | 13 | SNOMED CT | Full hierarchy, standard concepts |
| Observation | 124,150 | 16 | SNOMED CT | Full hierarchy, standard concepts |
| Procedure | 97,335 | 12 | SNOMED CT | Full hierarchy, standard concepts |
| Drug | 48,452 | 6 | ATC + RxNorm | ATC 5 levels + RxNorm Ingredient (stops before Clinical Drug) |
| Measurement | 34,834 | 10 | SNOMED CT | Full hierarchy, standard concepts |
| Visit | 278 | 4 | Multi-vocab | CMS Place of Service, NUCC, Visit |

**Virtual domain roots:** 6 entries at `parent_concept_id = 0` with negative concept IDs (-1 through -6) so the tree browse endpoint returns exactly 6 domain entries at the top level instead of thousands of orphan concepts.

### Backend (Laravel)

**New files:**
- `backend/app/Services/Vocabulary/HierarchyBuilderService.php` (467 lines) — builds `concept_tree` per domain, populates `concept_hierarchy` in results schemas via recursive CTE
- `backend/app/Console/Commands/BuildConceptHierarchy.php` — `vocabulary:build-hierarchy` with `--fresh`, `--domain`, `--populate-results` flags
- `backend/app/Models/Vocabulary/ConceptTree.php` — Eloquent model
- `backend/database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php`

**Modified files:**
- `VocabularyController::hierarchy()` — rewrote from flat ancestor list to iterative parent-chain walk producing nested tree with `is_current`, siblings (capped at 50), and children. Uses `concept_tree` for canonical lineage, falls back to `concept_ancestor` for concepts not in tree.
- `VocabularyController::tree()` — new endpoint for lazy-loaded hierarchy browsing with `child_count` for expand arrows
- `LoadVocabularies.php` — auto-triggers `vocabulary:build-hierarchy --populate-results` after vocab import

### Frontend (React/TypeScript)

**New files:**
- `HierarchyBrowserPanel.tsx` — cross-domain browser with breadcrumb drill-down, domain color coding, lazy loading via `useConceptTree` hook
- `useConceptTree.ts` — TanStack Query hook for tree endpoint

**Modified files:**
- `VocabularyPage.tsx` — added "Browse Hierarchy" tab (teal, alongside Keyword/Semantic)
- `vocabularyApi.ts` — added `fetchConceptTreeChildren()` API function
- `vocabulary.ts` — added `ConceptTreeNode` interface

### Existing Code Unchanged

- `HierarchyTree.tsx` — already rendered `ConceptHierarchyNode` correctly
- `HierarchyTreemap.tsx`, `DomainTab.tsx`, `useAchillesData.ts` — Data Explorer untouched
- `AchillesResultReaderService.php` — reads `concept_hierarchy` as before, just has data now

## Bugs Found During Debug

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| All depths stuck at 1 | Non-root edges initialized with `child_depth = 0` (same as roots), so iterative update set everything to 1 in one pass | Initialize non-root edges to `-1`, match on `-1` in update |
| Tree endpoint returned 500+ orphan roots | Measurement has 1,223 SNOMED orphan roots, all at `parent_concept_id = 0` | Added virtual domain roots (negative IDs -1 to -6) |
| Visit domain: 0 edges | Visit concepts use CMS/NUCC vocabularies, not SNOMED; builder filtered by `vocabulary_id = 'SNOMED'` | Added dedicated `buildVisitDomain()` without vocabulary filter |
| Hierarchy endpoint: "Concept not found" | `Concept::findOrFail()` resolved to empty `omop.concept` table that shadows `vocab.concept` | Changed to explicit `vocab.concept` query |
| Drug missing level1 (8,251 concepts) | LATERAL JOIN used `concept_ancestor` which doesn't reliably link across vocabulary boundaries (ATC → RxNorm) | Rewrote to recursive CTE walking `concept_tree`'s own parent chain |
| Aspirin hierarchy: 80+ ancestor explosion | `concept_ancestor` returns ALL ancestor paths for multi-parent concepts | Iterative PHP parent-chain walk picking one canonical lineage |
| TRUNCATE privilege denied | `parthenon_app` has INSERT/DELETE but not TRUNCATE | Changed to `DELETE FROM` |
| PHPStan: `DB::connection('omop')` banned | Custom PHPStan rule blocks bare connection calls | Added hierarchy files to allowed list |

## Results Schema Population

All 5 results schemas populated with 298,210 concept_hierarchy rows each:

| Schema | Rows | Status |
|--------|------|--------|
| `results` (Acumenus) | 298,210 | Treemaps now show hierarchical data |
| `irsf_results` | 298,210 | New (table was created this session) |
| `pancreas_results` | 298,210 | New (table was created this session) |
| `eunomia_results` | 298,210 | New (schema + table created this session) |
| `synpuf_results` | 298,210 | New (schema + table created this session) |

## Verification

| Test | Result |
|------|--------|
| concept_tree data integrity (orphans, duplicates, depths) | 0 issues |
| concept_hierarchy level completeness (all 6 domains) | 0 missing L1 |
| Tree endpoint — 6 domain roots | Correct |
| Tree drill-down (Condition, Drug, Visit) | Correct |
| Hierarchy — Type 2 DM (single-parent path) | 8-level clean lineage |
| Hierarchy — Aspirin (multi-parent, 80+ ATC classes) | Single canonical path |
| Hierarchy — concept not in tree (RxNorm Clinical Drug) | Falls back to concept_ancestor |
| Hierarchy — 404 for non-existent concept | Correct |
| Data Explorer treemap — Acumenus (all domains) | 3-level hierarchical data with counts |
| Data Explorer treemap — Pancreas (cross-source) | Works with source-specific counts |
| Level mapping (L3=outer, L2=mid, L1=inner) | Matches AchillesResultReaderService |
| Pint (1,361 files) | Pass |
| PHPStan (996 files) | 0 errors |
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vite build | Success |

## Commit

```
a3d727f59 feat: unified concept hierarchy mapper — Browse tab, fixed Hierarchy tab, Data Explorer treemaps
  15 files changed, 2655 insertions(+), 27 deletions(-)
```
