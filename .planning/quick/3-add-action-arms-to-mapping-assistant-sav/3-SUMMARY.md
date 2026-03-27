---
phase: quick-3
plan: 01
subsystem: vocabulary/ariadne
tags: [mapping, vocabulary, ariadne, save, projects]
dependency_graph:
  requires: [ariadne-ai-service, source-to-concept-map-table]
  provides: [save-mappings-endpoint, mapping-projects-crud, mapping-action-ui]
  affects: [source_to_concept_map, mapping_projects]
tech_stack:
  added: []
  patterns: [SourceAware-trait, useMutation-toast-pattern, load-project-dropdown]
key_files:
  created:
    - backend/database/migrations/2026_03_27_200000_create_mapping_projects_table.php
    - backend/app/Models/App/MappingProject.php
    - backend/app/Http/Requests/Api/SaveMappingsRequest.php
    - backend/app/Http/Requests/Api/SaveMappingProjectRequest.php
  modified:
    - backend/app/Http/Controllers/Api/V1/AriadneController.php
    - backend/routes/api.php
    - frontend/src/features/vocabulary/api/ariadneApi.ts
    - frontend/src/features/vocabulary/pages/MappingAssistantPage.tsx
decisions:
  - Used SourceAware trait vocab() instead of direct DB::connection('omop') per PHPStan custom rule
  - Raw DB insert for source_to_concept_map (VocabularyModel is read-only by convention)
  - Inline project name input instead of modal for lightweight UX
metrics:
  duration: 6min
  completed: "2026-03-27"
  tasks: 2
  files: 8
---

# Quick Task 3: Add Action Arms to Mapping Assistant Summary

Save-to-vocabulary and project persistence for the Ariadne Mapping Assistant via 4 new API endpoints and interactive UI with toast feedback.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Backend: migration, model, Form Requests, controller methods, routes | 4b8b70965 | AriadneController.php, MappingProject.php, api.php |
| 2 | Frontend: API functions, action buttons, load project UI, toast feedback | a657163ee | ariadneApi.ts, MappingAssistantPage.tsx |

## What Was Built

### Backend
- **Migration** creates `app.mapping_projects` table with JSON columns for source_terms, results, decisions, filters
- **MappingProject** model with array casts, user relationship, and proper fillable/PHPDoc
- **SaveMappingsRequest** validates mapping entries (source_code, target_concept_id, etc.)
- **SaveMappingProjectRequest** validates project payloads (name, source_terms, results, decisions)
- **AriadneController** gained 4 methods:
  - `saveMappings` -- inserts accepted mappings into source_to_concept_map via SourceAware vocab() in a transaction
  - `saveProject` -- persists full session state as a MappingProject
  - `listProjects` -- paginated list for authenticated user
  - `loadProject` -- ownership-verified single project load
- **Routes** protected with `permission:mapping.review` (save-mappings) and `permission:mapping.view` (projects)

### Frontend
- **ariadneApi.ts** exports 4 new functions + 3 new types (SaveMappingEntry, MappingProject, SaveProjectParams)
- **"Save to Vocabulary" button** -- crimson primary, persists accepted best_match entries to source_to_concept_map
- **"Save Project" button** -- opens inline name input, persists full session (terms, results, decisions, filters)
- **"Load Project" dropdown** -- next to CSV upload, fetches project list on open, restores full session state on click
- **Toast notifications** on success/error for all save and load operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PHPStan bans direct DB::connection('omop')**
- **Found during:** Task 1
- **Issue:** Custom PHPStan rule requires SourceAware trait instead of hardcoded DB::connection('omop')
- **Fix:** Added `use SourceAware` to AriadneController, replaced DB::connection('omop') with `$this->vocab()`
- **Files modified:** backend/app/Http/Controllers/Api/V1/AriadneController.php
- **Commit:** 4b8b70965

## Verification

- Pint: PASS
- PHPStan: PASS (0 errors)
- TypeScript (tsc --noEmit): PASS
- Vite build: PASS
- Migration: PASS (mapping_projects table created)
