---
phase: quick-16
plan: 01
subsystem: vocabulary
tags: [snomed, hierarchy, cross-domain, clinical-groupings, browse-ui]
dependency_graph:
  requires: [vocab.concept_tree, vocab.concept_ancestor]
  provides: [cross-domain-snomed-tree, clinical-groupings-api, groupings-ui]
  affects: [HierarchyBrowserPanel, VocabularyController, HierarchyBuilderService]
tech_stack:
  added: []
  patterns: [cross-domain-snomed-tree, clinical-groupings-seeder, groupings-card-ui]
key_files:
  created:
    - backend/app/Models/App/ClinicalGrouping.php
    - backend/database/migrations/2026_04_05_100000_create_clinical_groupings_table.php
    - backend/database/seeders/ClinicalGroupingSeeder.php
    - frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts
  modified:
    - backend/app/Services/Vocabulary/HierarchyBuilderService.php
    - backend/app/Http/Controllers/Api/V1/VocabularyController.php
    - backend/routes/api.php
    - frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx
    - frontend/src/features/vocabulary/api/vocabularyApi.ts
    - frontend/src/features/vocabulary/types/vocabulary.ts
decisions:
  - concept_tree PK altered to (parent_concept_id, child_concept_id, domain_id) to support same edge in multiple domain trees
  - Cross-domain parents become natural roots in target domain rather than being filtered out
  - Clinical groupings provide curated entry points; raw roots available via Show All toggle
  - Seeder resolves anchor concept_ids by name pattern matching for vocabulary version independence
metrics:
  duration: 42min
  completed: "2026-04-05T04:42:00Z"
---

# Quick Task 16: Rebuild Cross-Domain SNOMED Concept Hierarchy

Cross-domain unified SNOMED tree builder with clinical groupings navigation layer for Browse Hierarchy UI.

## What Changed

### Task 1: Cross-Domain SNOMED Tree Builder
- Replaced `buildSnomedDomain()` with `buildUnifiedSnomedTree()` in HierarchyBuilderService
- **Core fix**: Removed `AND parent.domain_id = ?` filter from concept_ancestor JOIN — SNOMED hierarchy crosses OMOP domain boundaries (e.g., "Cardiovascular finding" in Observation domain parents Condition concepts)
- Each edge tagged with child's domain_id for domain-filtered tree queries
- Altered concept_tree PK from `(parent_concept_id, child_concept_id)` to `(parent_concept_id, child_concept_id, domain_id)` to allow same edge in multiple domain contexts
- **Results**: Condition 226K edges (depth 13), Measurement 36K (depth 11), Observation 126K (depth 16), Procedure 97K (depth 12) — all deep navigable trees vs previous flat orphans
- Drug (14 roots) and Visit (19 roots) unchanged

### Task 2: Clinical Groupings
- Created `app.clinical_groupings` table with domain_id, anchor_concept_ids (integer array), sort_order, icon, color
- ClinicalGrouping Eloquent model with parent/children self-referential relationships
- Seeded 39 curated groupings: 20 Condition, 8 Measurement, 6 Observation, 5 Procedure
- Seeder resolves anchor concept_ids from vocab.concept by ILIKE name matching — vocabulary-version independent
- GET `/v1/vocabulary/groupings?domain_id=X` endpoint inside existing auth:sanctum + vocabulary.view middleware

### Task 3: Browse Hierarchy UI Integration
- HierarchyBrowserPanel shows clinical grouping cards at domain level for SNOMED domains
- Cards display name, description, color accent bar (domain-specific)
- Clicking a grouping drills into its anchor concept's SNOMED subtree
- "Show all concepts" / "Show groupings" toggle for power users vs curated navigation
- Drug and Visit domains skip groupings (show raw tree as before)
- Breadcrumb navigation back to domain root restores groupings view

## Deviations from Plan

### [Rule 1 - Bug] concept_tree PK needed domain_id
- **Found during:** Task 1
- **Issue:** The original PK `(parent_concept_id, child_concept_id)` prevented the same edge from appearing with different domain tags. Cross-domain parent chains need edges tagged with multiple domains.
- **Fix:** ALTER TABLE to include domain_id in PK. Updated all ON CONFLICT clauses.
- **Commit:** c4a12935a

### [Deviation] Root count higher than plan target
- **Found during:** Task 1 verification
- **Issue:** Plan expected <30 roots per domain after fix. Actual: 839 Condition, 620 Measurement, 822 Observation. This is correct — cross-domain organizing concepts (e.g., Observation-domain concepts that parent Condition children) become natural roots in the target domain.
- **Impact:** None on UX — clinical groupings (Task 2-3) provide curated entry points. Raw roots available via "Show all" toggle.

### [Rule 3 - Blocking] Node container ENOSPC
- **Found during:** Task 3 TypeScript verification
- **Issue:** Docker node container in restart loop due to inotify watcher exhaustion (ENOSPC)
- **Fix:** Increased `fs.inotify.max_user_watches` to 524288 and restarted container
- **Files modified:** None (runtime fix)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c4a12935a | Cross-domain SNOMED tree builder |
| 2 | 7a41a2ab5 | Clinical groupings table, model, seeder, API |
| 3 | 4b0f8af45 | Browse Hierarchy UI with groupings |
