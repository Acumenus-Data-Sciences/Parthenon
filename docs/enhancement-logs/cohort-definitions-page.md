# Cohort Definitions Page Enhancement Log

**Date:** 2026-03-04
**Scope:** `/cohort-definitions` page — sample data, UX enhancements, Care Bundle integration

---

## Summary

Comprehensive enhancement of the Cohort Definitions page covering 5 sample cohort definitions seeded from Care Gap bundles, a "Create from Care Bundle" workflow, search/filter, stats dashboard, enhanced table columns, and detail page polish (inline tag editing, Ctrl+S save, timestamps).

## Changes

### Phase 1: Sample Cohort Definition Seeder

#### 1A. CohortDefinitionSeeder with 5 realistic cohorts
- **New file:** `backend/database/seeders/CohortDefinitionSeeder.php`
- **Modified:** `backend/database/seeders/DatabaseSeeder.php`
- 5 sample cohorts with full OHDSI CohortExpression JSON:
  1. Type 2 Diabetes Mellitus — condition + HbA1c lab criteria
  2. Essential Hypertension with Antihypertensive Therapy — condition + drug criteria
  3. Coronary Artery Disease with Statin Therapy — condition + statin drug criteria
  4. Heart Failure with BNP Monitoring — condition + BNP measurement criteria
  5. Chronic Kidney Disease Stage 3-5 with eGFR Monitoring — condition + eGFR lab criteria
- All concept IDs sourced from existing `ConditionBundleSeeder`
- Idempotent via `firstOrCreate` keyed on name

### Phase 2: "Create from Care Bundle" Backend

#### 2A. `createFromBundle()` endpoint
- **File:** `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php`
- **Route:** `POST /api/v1/cohort-definitions/from-bundle`
- Accepts `{ bundle_id, include_measures?, name? }`
- Loads ConditionBundle with measures, auto-generates:
  - ConceptSet[0]: primary condition concepts from bundle's `omop_concept_ids`
  - ConceptSet[1-N]: one per quality measure from `numerator_criteria.concept_ids`
  - PrimaryCriteria: ConditionOccurrence referencing CodesetId 0
  - AdditionalCriteria: ALL group with windowed criteria per measure (domain-mapped)
- Auto-tags with `[bundle_code, disease_category, "from-bundle"]`

#### 2B. `stats()` endpoint
- **Route:** `GET /api/v1/cohort-definitions/stats`
- Returns `{ total, with_generations, public }` — aggregate counts

#### 2C. `tags` validation on update
- Added `tags` and `tags.*` validation rules to the `update()` method

### Phase 3: Frontend UX Enhancements

#### 3A. Search bar
- **File:** `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`
- Debounced search input (300ms) that passes `search` param to backend's existing `?search=` filter
- Page resets to 1 when search or tags change

#### 3B. Quick stats bar
- **New file:** `frontend/src/features/cohort-definitions/components/CohortStatsBar.tsx`
- 3 metric cards (Total, Generated, Public) with IBM Plex Mono numbers
- `useCohortStats` hook queries `/stats` endpoint

#### 3C. "Create from Care Bundle" modal
- **New file:** `frontend/src/features/cohort-definitions/components/CreateFromBundleModal.tsx`
- "From Bundle" button in page header opens modal
- Lists all 10 disease bundles with filter, code badge, measure count
- Selection reveals name input + "Include quality measures" toggle
- Creates cohort and navigates to detail page on success

#### 3D. Enhanced table columns
- **File:** `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx`
- Added Author, Tags, and Public/Private icon columns
- Description shown as subtitle under name
- Improved empty state with two CTA buttons

#### 3E. Type updates
- **File:** `frontend/src/features/cohort-definitions/types/cohortExpression.ts`
- `CohortDefinitionListParams.q` → `search` (matches backend param)
- Added `tags`, `author` fields to `CohortDefinition` interface
- Added `tags` to `UpdateCohortDefinitionPayload`

### Phase 4: Detail Page Polish

#### 4A. Inline tag editing
- **File:** `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`
- Tag chips with hover-to-remove (X button)
- "+" button to add new tags inline
- Tags saved via `updateCohortDefinition` mutation

#### 4B. Keyboard shortcut for save
- `Ctrl+S` / `Cmd+S` triggers expression save when dirty
- Uses `useEffect` with `keydown` listener

#### 4C. Last modified timestamp
- Shows "Last saved {date}" next to version badge

## Files Modified

| File | Change |
|------|--------|
| **NEW** `backend/database/seeders/CohortDefinitionSeeder.php` | 5 sample cohort definitions |
| `backend/database/seeders/DatabaseSeeder.php` | Register CohortDefinitionSeeder |
| `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` | `createFromBundle()`, `stats()`, tags validation |
| `backend/routes/api.php` | 2 new routes (from-bundle, stats) |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx` | Search bar, stats bar, "From Bundle" button |
| `frontend/src/features/cohort-definitions/components/CohortDefinitionList.tsx` | Search prop, enhanced columns, empty state |
| **NEW** `frontend/src/features/cohort-definitions/components/CreateFromBundleModal.tsx` | Bundle picker modal |
| **NEW** `frontend/src/features/cohort-definitions/components/CohortStatsBar.tsx` | Stats bar |
| `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts` | `useCohortStats`, `useCreateCohortFromBundle` hooks |
| `frontend/src/features/cohort-definitions/api/cohortApi.ts` | `getCohortStats()`, `createCohortFromBundle()` |
| `frontend/src/features/cohort-definitions/types/cohortExpression.ts` | Updated types (search, tags, author) |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx` | Tags editing, Ctrl+S, last modified |

## Cross-Feature Dependencies

- `CreateFromBundleModal` imports `listBundles()` from `care-gaps` feature API
- Bundle concept IDs in seeder match those in `ConditionBundleSeeder`
- Both are acceptable cross-feature dependencies since cohort definitions and care bundles are tightly coupled in clinical research workflows

## Gotchas

- **Route order matters:** `from-bundle` and `stats` routes MUST be registered before `apiResource('cohort-definitions')` to avoid being caught by the `{cohortDefinition}` wildcard
- **Tags jsonb filter:** Backend uses `tags @> ?::jsonb` for array containment — requires PostgreSQL
- **Ctrl+S in useEffect:** Must inline the mutation call to avoid stale closure over `handleSaveExpression`
- **`CohortDefinitionListParams.q` → `search`:** Backend expects `?search=`, not `?q=`. Renamed to match.
